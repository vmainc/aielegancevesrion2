# Netlify Deployment Setup

This guide explains how to configure environment variables on Netlify for your AI Elegance application.

## Required Environment Variables

You need to set the following environment variables in your Netlify dashboard:

### 1. PocketBase Configuration

#### POCKETBASE_URL
Your PocketHost instance URL (e.g., `https://your-instance.pockethost.io`)

**How to set:**
1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable**
5. Key: `POCKETBASE_URL`
6. Value: Your PocketHost URL (e.g., `https://your-instance.pockethost.io`)
7. Click **Save**

#### POCKETBASE_ADMIN_EMAIL
Your PocketHost admin email address

**Important:** This is different from your user account. You need the admin credentials from your PocketHost dashboard.

**How to find:**
1. Log into your PocketHost dashboard
2. Go to your instance settings
3. Look for admin credentials or create an admin account

#### POCKETBASE_ADMIN_PASSWORD
Your PocketHost admin password

### 2. OpenRouter API Key (Required for AI queries)

To enable AI model queries, add the OpenRouter API key:

- `OPENROUTER_API_KEY` - Your OpenRouter API key (get it from https://openrouter.ai)

## Steps to Configure

1. **Log into Netlify Dashboard**
   - Go to [app.netlify.com](https://app.netlify.com)

2. **Select Your Site**
   - Click on your AI Elegance site

3. **Navigate to Environment Variables**
   - Go to **Site settings** (top menu)
   - Click **Environment variables** in the left sidebar
   - Or go to **Deploys** → **Trigger deploy** → **Deploy settings** → **Environment variables**

4. **Add Variables**
   - Click **Add a variable** or **Add variable**
   - Enter the key (e.g., `POCKETBASE_URL`)
   - Enter the value (e.g., `https://your-instance.pockethost.io`)
   - Click **Save**

5. **Redeploy**
   - After adding environment variables, you need to trigger a new deployment
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - Or push a new commit to trigger an automatic deployment

## Verification

After setting the environment variables and redeploying:

1. Check your site's build logs to verify the variables are loaded
2. Try logging in - it should connect to your PocketHost instance instead of localhost
3. Check the browser console - there should be no `127.0.0.1:8090` connection errors

## Troubleshooting

### Still seeing `127.0.0.1:8090` errors?

- **Check environment variables are set correctly** - Make sure `POCKETBASE_URL` is set to your PocketHost URL
- **Verify the variable name** - It must be exactly `POCKETBASE_URL` (case-sensitive)
- **Redeploy after changes** - Environment variable changes require a new deployment
- **Check build logs** - Look for any errors during the build process

### 500 errors on API endpoints?

- **Verify admin credentials** - Make sure `POCKETBASE_ADMIN_EMAIL` and `POCKETBASE_ADMIN_PASSWORD` are correct
- **Check PocketHost connection** - Ensure your PocketHost instance is accessible and running
- **Review server logs** - Check Netlify function logs for detailed error messages

### Can't log in?

- **Verify PocketHost URL** - Make sure the URL is correct and accessible
- **Check CORS settings** - Ensure PocketHost allows requests from your Netlify domain
- **Verify user exists** - Make sure the user account exists in your PocketBase database

## Important Notes

- Environment variables are **case-sensitive**
- Changes to environment variables require a **new deployment** to take effect
- Private environment variables (starting with `POCKETBASE_ADMIN_`) are only available server-side
- Public environment variables (like `POCKETBASE_URL`) are exposed to the client-side code

## Quick Reference

Minimum required variables:
```
POCKETBASE_URL=https://your-instance.pockethost.io
POCKETBASE_ADMIN_EMAIL=admin@example.com
POCKETBASE_ADMIN_PASSWORD=your-admin-password
```

OpenRouter API key (for AI queries):
```
OPENROUTER_API_KEY=sk-or-v1-...
```




