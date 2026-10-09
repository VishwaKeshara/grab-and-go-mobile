BEGIN;

-- ============================================================
-- 1. Existing shop_staff compatibility
-- ============================================================

ALTER TABLE public.shop_staff
ALTER COLUMN full_name DROP NOT NULL;

UPDATE public.shop_staff
SET staff_code = upper(trim(staff_code))
WHERE staff_code IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT shop_id, staff_code
    FROM public.shop_staff
    WHERE staff_code IS NOT NULL
    GROUP BY shop_id, staff_code
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate staff codes exist inside a shop';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS shop_staff_shop_code_uidx
ON public.shop_staff(shop_id, staff_code);


-- ============================================================
-- 2. Human-readable shop code
-- ============================================================

ALTER TABLE public.customer_shops
ADD COLUMN IF NOT EXISTS shop_code text;

UPDATE public.customer_shops
SET shop_code = upper(trim(shop_code))
WHERE shop_code IS NOT NULL
  AND trim(shop_code) <> '';

DO $$
BEGIN
  IF EXISTS (
    SELECT shop_code
    FROM public.customer_shops
    WHERE shop_code IS NOT NULL
      AND trim(shop_code) <> ''
    GROUP BY shop_code
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate shop codes exist';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS customer_shops_shop_code_uidx
ON public.customer_shops(shop_code)
WHERE shop_code IS NOT NULL;


CREATE OR REPLACE FUNCTION public.generate_shop_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NEW.shop_code IS NOT NULL
     AND trim(NEW.shop_code) <> '' THEN
    NEW.shop_code := upper(trim(NEW.shop_code));
    RETURN NEW;
  END IF;

  LOOP
    v_code :=
      upper(
        substring(
          encode(
            extensions.gen_random_bytes(4),
            'hex'
          )
          from 1 for 8
        )
      );

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.customer_shops
      WHERE shop_code = v_code
    );
  END LOOP;

  NEW.shop_code := v_code;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS set_shop_code
ON public.customer_shops;

CREATE TRIGGER set_shop_code
BEFORE INSERT OR UPDATE OF shop_code
ON public.customer_shops
FOR EACH ROW
WHEN (
  NEW.shop_code IS NULL
  OR trim(NEW.shop_code) = ''
)
EXECUTE FUNCTION public.generate_shop_code();


-- Force trigger generation for old rows.

UPDATE public.customer_shops
SET shop_code = NULL
WHERE shop_code IS NULL
   OR trim(shop_code) = '';


DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.customer_shops
    WHERE shop_code IS NULL
       OR trim(shop_code) = ''
  ) THEN
    RAISE EXCEPTION 'Shop code backfill failed';
  END IF;
END;
$$;


ALTER TABLE public.customer_shops
ALTER COLUMN shop_code SET NOT NULL;


-- ============================================================
-- 3. Staff session table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  token_hash text NOT NULL UNIQUE,

  staff_id uuid NOT NULL
    REFERENCES public.shop_staff(id)
    ON DELETE CASCADE,

  created_at timestamptz NOT NULL
    DEFAULT now(),

  expires_at timestamptz NOT NULL
    DEFAULT (now() + interval '8 hours'),

  revoked_at timestamptz NULL
);


ALTER TABLE public.staff_sessions
ADD COLUMN IF NOT EXISTS revoked_at timestamptz;


ALTER TABLE public.staff_sessions
ALTER COLUMN token_hash SET NOT NULL;

ALTER TABLE public.staff_sessions
ALTER COLUMN staff_id SET NOT NULL;

ALTER TABLE public.staff_sessions
ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.staff_sessions
ALTER COLUMN expires_at SET NOT NULL;


ALTER TABLE public.staff_sessions
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.staff_sessions
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 4. Internal staff-session resolver
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_staff_session(
  p_token text
)
RETURNS TABLE (
  staff_id uuid,
  shop_id uuid,
  staff_code text,
  shop_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL
     OR length(trim(p_token)) < 20 THEN
    RETURN;
  END IF;

  v_hash :=
    encode(
      extensions.digest(
        convert_to(trim(p_token), 'UTF8'),
        'sha256'
      ),
      'hex'
    );

  RETURN QUERY
  SELECT
    s.id,
    cs.id,
    s.staff_code,
    cs.name
  FROM public.staff_sessions ss
  JOIN public.shop_staff s
    ON s.id = ss.staff_id
  JOIN public.customer_shops cs
    ON cs.id = s.shop_id
  WHERE ss.token_hash = v_hash
    AND ss.revoked_at IS NULL
    AND ss.expires_at > now()
    AND s.is_active = true
    AND cs.active = true;
END;
$$;

REVOKE ALL
ON FUNCTION public.resolve_staff_session(text)
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 5. Staff PIN login
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_staff_pin(
  p_staff_code text,
  p_pin_plain text,
  p_shop_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.customer_shops;
  v_staff public.shop_staff;

  v_staff_code text :=
    upper(trim(coalesce(p_staff_code, '')));

  v_shop_code text :=
    upper(trim(coalesce(p_shop_code, '')));

  v_pin text :=
    trim(coalesce(p_pin_plain, ''));

  v_raw_token text;
  v_token_hash text;
BEGIN
  IF length(v_staff_code) < 2
     OR length(v_staff_code) > 40
     OR v_staff_code !~ '^[A-Z0-9_-]+$' THEN

    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_credentials'
    );
  END IF;


  IF v_pin !~ '^[0-9]{4}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_credentials'
    );
  END IF;


  IF length(v_shop_code) < 2
     OR length(v_shop_code) > 40 THEN

    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_credentials'
    );
  END IF;


  SELECT *
  INTO v_shop
  FROM public.customer_shops
  WHERE shop_code = v_shop_code
    AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_credentials'
    );
  END IF;


  SELECT *
  INTO v_staff
  FROM public.shop_staff
  WHERE shop_id = v_shop.id
    AND staff_code = v_staff_code
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_credentials'
    );
  END IF;


  IF extensions.crypt(
       v_pin,
       v_staff.pin_hash
     ) <> v_staff.pin_hash THEN

    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_credentials'
    );
  END IF;


  v_raw_token :=
    encode(
      extensions.gen_random_bytes(32),
      'hex'
    );

  v_token_hash :=
    encode(
      extensions.digest(
        convert_to(v_raw_token, 'UTF8'),
        'sha256'
      ),
      'hex'
    );

  INSERT INTO public.staff_sessions (
    token_hash,
    staff_id
  )
  VALUES (
    v_token_hash,
    v_staff.id
  );

  RETURN jsonb_build_object(
    'success', true,
    'token', v_raw_token,
    'staff_code', v_staff.staff_code,
    'shop_name', v_shop.name
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.verify_staff_pin(text, text, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.verify_staff_pin(text, text, text)
TO anon, authenticated;


-- ============================================================
-- 6. Safe Staff Profile
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_staff_profile(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
BEGIN
  SELECT *
  INTO v_ctx
  FROM public.resolve_staff_session(p_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'staff_code', v_ctx.staff_code,
    'shop_name', v_ctx.shop_name
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.get_staff_profile(text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_staff_profile(text)
TO anon, authenticated;


-- ============================================================
-- 7. End Staff Shift
-- ============================================================

CREATE OR REPLACE FUNCTION public.end_staff_session(
  p_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL
     OR trim(p_token) = '' THEN
    RETURN;
  END IF;

  v_hash :=
    encode(
      extensions.digest(
        convert_to(trim(p_token), 'UTF8'),
        'sha256'
      ),
      'hex'
    );

  UPDATE public.staff_sessions
  SET revoked_at = now()
  WHERE token_hash = v_hash
    AND revoked_at IS NULL;
END;
$$;

REVOKE ALL
ON FUNCTION public.end_staff_session(text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.end_staff_session(text)
TO anon, authenticated;


-- ============================================================
-- 8. Owner: Add Staff
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_shop_staff(
  p_shop_id uuid,
  p_staff_code text,
  p_pin_plain text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_code text :=
    upper(trim(coalesce(p_staff_code, '')));

  v_pin text :=
    trim(coalesce(p_pin_plain, ''));

  v_staff public.shop_staff;
BEGIN
  IF NOT (
    public.is_shop_owner(p_shop_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF length(v_staff_code) < 2
     OR length(v_staff_code) > 40
     OR v_staff_code !~ '^[A-Z0-9_-]+$' THEN

    RAISE EXCEPTION
      'Staff ID must contain 2-40 letters, numbers, hyphens or underscores';
  END IF;

  IF v_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION
      'PIN must be exactly 4 digits';
  END IF;

  INSERT INTO public.shop_staff (
    shop_id,
    staff_code,
    pin_hash,
    full_name
  )
  VALUES (
    p_shop_id,
    v_staff_code,
    extensions.crypt(
      v_pin,
      extensions.gen_salt('bf')
    ),
    NULL
  )
  RETURNING *
  INTO v_staff;

  RETURN jsonb_build_object(
    'id', v_staff.id,
    'staff_code', v_staff.staff_code,
    'is_active', v_staff.is_active
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.add_shop_staff(uuid, text, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.add_shop_staff(uuid, text, text)
TO authenticated;


-- ============================================================
-- 9. Owner: List Staff
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_shop_staff(
  p_shop_id uuid
)
RETURNS TABLE (
  id uuid,
  staff_code text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_shop_owner(p_shop_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.staff_code,
    s.is_active
  FROM public.shop_staff s
  WHERE s.shop_id = p_shop_id
  ORDER BY s.staff_code;
END;
$$;

REVOKE ALL
ON FUNCTION public.list_shop_staff(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.list_shop_staff(uuid)
TO authenticated;


-- ============================================================
-- 10. Owner: Reset PIN
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_staff_pin(
  p_staff_id uuid,
  p_new_pin text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_pin text :=
    trim(coalesce(p_new_pin, ''));
BEGIN
  SELECT shop_id
  INTO v_shop_id
  FROM public.shop_staff
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff not found';
  END IF;

  IF NOT (
    public.is_shop_owner(v_shop_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION
      'PIN must be exactly 4 digits';
  END IF;

  UPDATE public.shop_staff
  SET pin_hash =
    extensions.crypt(
      v_pin,
      extensions.gen_salt('bf')
    )
  WHERE id = p_staff_id;

  UPDATE public.staff_sessions
  SET revoked_at = now()
  WHERE staff_id = p_staff_id
    AND revoked_at IS NULL;
END;
$$;

REVOKE ALL
ON FUNCTION public.reset_staff_pin(uuid, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.reset_staff_pin(uuid, text)
TO authenticated;


-- ============================================================
-- 11. Owner: Activate / Deactivate
-- ============================================================

CREATE OR REPLACE FUNCTION public.toggle_staff_status(
  p_staff_id uuid,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id
  INTO v_shop_id
  FROM public.shop_staff
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff not found';
  END IF;

  IF NOT (
    public.is_shop_owner(v_shop_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.shop_staff
  SET is_active = p_is_active
  WHERE id = p_staff_id;

  IF p_is_active = false THEN
    UPDATE public.staff_sessions
    SET revoked_at = now()
    WHERE staff_id = p_staff_id
      AND revoked_at IS NULL;
  END IF;
END;
$$;

REVOKE ALL
ON FUNCTION public.toggle_staff_status(uuid, boolean)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.toggle_staff_status(uuid, boolean)
TO authenticated;

COMMIT;
