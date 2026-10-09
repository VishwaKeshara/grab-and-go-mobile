# Grab & Go Mobile

Grab & Go is an Expo and React Native mobile app for local grocery ordering, live price comparison, pickup hubs, locker collection, and shop operations.

## Requirements

- Node.js 20 or newer
- npm
- Expo Go for device testing, or an Android/iOS simulator
- A Supabase project for authentication and database features
- Supabase CLI for migrations and database deployment

## Installation

Install the project dependencies:

```bash
npm install
```

The project includes these important integrations:

- `expo-router` for file-based navigation
- `@supabase/supabase-js` for authentication and database access
- `@react-native-async-storage/async-storage` for persistent native sessions
- `expo-auth-session` and `expo-web-browser` for Google and Apple OAuth
- `expo-linking` for mobile deep links
- `@expo/vector-icons` for navigation and provider icons
- `expo-image` for performant image rendering
- `eslint` and `eslint-config-expo` for linting

## Environment Setup

Create a local environment file from the template:

```powershell
Copy-Item .env.example .env
```

Set the Supabase values in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Never commit `.env` or service-role/database passwords. The mobile app must use a publishable key only.

## Supabase Setup

Install or run the Supabase CLI:

```bash
npx --yes supabase --version
```

Authenticate and link the project:

```bash
npx --yes supabase login
npx --yes supabase link --project-ref your-project-ref
```

Apply the database migrations:

```bash
npx --yes supabase db push
```

The migrations create and secure user profiles, pickup hubs, notifications, admin user management policies, and active/suspended account status handling.

Migration `005_catalog_reviews_favourites_search_reports.sql` adds the catalogue layer used by Search, Product Details, Shop Management, and Reports:

- `shops` and `products` for listings, with `is_available` and `stock_quantity` driving the "in stock only" filter
- `reviews` (one per user per product), `favourites`, and `search_history` for the customer screens
- `reports` for generated shop reports, storing the aggregate snapshot in a `payload` jsonb column

It also seeds three shops and six products so Search and Product Details have data immediately. Shop ownership is enforced with the `public.owns_shop()` helper, and every table has row level security enabled.

Check migration synchronization with:

```bash
npx --yes supabase migration list
```

## Authentication Providers

### Email confirmation

In Supabase, open **Authentication → Providers → Email** and enable the email provider. New accounts use the standard email confirmation link, followed by email-and-password login.

For reliable delivery, configure a transactional SMTP provider under **Authentication → SMTP Settings**. Example Brevo settings:

```text
Host: smtp-relay.brevo.com
Port: 587
Username: your Brevo account email
Password: your Brevo SMTP key
Sender email: a verified sender address
Sender name: Grab & Go
```

### Google and Apple OAuth

Enable the provider in **Authentication → Providers**, then add this callback under **Authentication → URL Configuration**:

```text
grabandgomobile://auth/callback
```

When testing with Expo Go, also add the current generated callback, for example:

```text
exp://192.168.x.x:8081/--/auth/callback
```

For Google and Apple provider consoles, use this Supabase callback URL:

```text
https://your-project-ref.supabase.co/auth/v1/callback
```

## Running the App

Start the development server:

```bash
npx expo start
```

Clear Metro cache when route or dependency changes are not appearing:

```bash
npx expo start -c
```

Useful scripts:

```bash
npm run android
npm run ios
npm run web
npm run lint
npx tsc --noEmit
```

## Navigation

Routes are stored in `app/` and grouped by role:

- `app/(auth)/` - splash, onboarding, login, signup, and password reset
- `app/(customer)/` - customer ordering, profile, notifications, and tracking
- `app/(shop)/` - shop operations and order packing
- `app/(admin)/` - admin dashboard, user management, and security monitoring

The customer layout provides the shared customer header and bottom navigation for Home, Search, Orders, and Profile.

## Validation

Run the standard checks before submitting changes:

```bash
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

## Project Structure

```text
app/                 Expo Router screens and layouts
assets/              Images, icons, and app assets
components/          Shared UI components
constants/           Colors, routes, and configuration
hooks/               Reusable React hooks
lib/                 Supabase and database clients
services/            Auth, admin, product, order, and notification services
types/               TypeScript domain types
utils/               Formatting and validation helpers
supabase/migrations/ Versioned database schema and RLS policies
```
