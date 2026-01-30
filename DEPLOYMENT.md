# Deployment Instructions

## Cloudflare Workers Deployment via GitHub

### Issue
When deploying via GitHub integration, Cloudflare may attempt to use `wrangler versions upload` which is not supported for Workers Sites projects. This causes the error:
```
Workers Sites does not support uploading versions through 'wrangler versions upload'. 
You must use 'wrangler deploy' instead.
```

### Solution

#### Option 1: Configure Build Settings in Cloudflare Dashboard (Recommended)

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **product-manager-intern-assignment**
2. Click **Settings** → **Builds & deployments**
3. Under **Build configuration**, set:
   - **Build command**: `npm run build`
   - **Build output directory**: Leave empty or set to `.`
   - **Root directory**: Leave empty or set to `/`
4. Save the settings

#### Option 2: Deploy Manually via CLI

If automatic deployment continues to fail, deploy manually:

```bash
# Build the project (embeds HTML content)
npm run build

# Deploy to Cloudflare Workers
wrangler deploy
```

### Important Notes

- The project uses **embedded HTML** (not Workers Sites), so `[site]` configuration has been removed from `wrangler.toml`
- HTML content is embedded at build time via `build-html.js`
- The build script must run before deployment to generate `src/html-content.js`

### Build Process

The build process:
1. Reads `index.html`
2. Generates `src/html-content.js` with embedded HTML
3. Worker imports and serves the embedded HTML

This approach avoids Workers Sites deployment issues while maintaining fast edge delivery.
