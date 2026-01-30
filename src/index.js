// Main Worker entry point
// Import API handlers
import { onRequestGet as queryHandler } from '../functions/api/query.js';
import { onRequestPost as seedHandler } from '../functions/api/seed.js';
import { onRequestPost as processHandler } from '../functions/api/process.js';
import { onRequestPost as aiAdviceHandler } from '../functions/api/ai-advice.js';
import { onRequestPost as saveViewPostHandler, onRequestGet as saveViewGetHandler } from '../functions/api/save-view.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle API routes
    if (path.startsWith('/api/')) {
      return handleAPI(request, env, ctx, path);
    }

    // Serve static files using ASSETS binding
    // For root path, serve index.html
    let assetPath = path === '/' ? '/index.html' : path;
    
    // Try to fetch from assets (works with both [site] and [assets] config)
    // In Wrangler v3+, ASSETS binding is available when [assets] is configured
    if (env.ASSETS) {
      try {
        const assetRequest = new Request(new URL(assetPath, request.url).toString(), {
          method: request.method,
          headers: request.headers,
        });
        const assetResponse = await env.ASSETS.fetch(assetRequest);
        
        // If asset found, return it
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch (e) {
        console.error('Error fetching asset:', e);
      }
    }

    // Fallback: for SPA routing, serve index.html
    if (!path.includes('.')) {
      // Try to get index.html from assets
      if (env.ASSETS) {
        try {
          const indexRequest = new Request(new URL('/index.html', request.url).toString());
          const indexResponse = await env.ASSETS.fetch(indexRequest);
          if (indexResponse.status !== 404) {
            return indexResponse;
          }
        } catch (e) {
          console.error('Error fetching index.html:', e);
        }
      }
      
      // If ASSETS is not available, return helpful error
      return new Response(
        `Not Found - Path: ${path}\n` +
        `ASSETS binding: ${env.ASSETS ? 'available' : 'not available'}\n` +
        `Please ensure:\n` +
        `1. [assets] directory is configured in wrangler.toml\n` +
        `2. index.html exists in the project root\n` +
        `3. Deploy with: wrangler deploy`,
        { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }

    // 404 for other paths
    return new Response('Not Found', { status: 404 });
  },
};

async function handleAPI(request, env, ctx, path) {
  try {
    // Route to appropriate API handler
    if (path === '/api/query') {
      return await queryHandler({ env, request });
    } else if (path === '/api/seed') {
      if (request.method === 'POST') {
        return await seedHandler({ env, request });
      }
    } else if (path === '/api/process') {
      if (request.method === 'POST') {
        return await processHandler({ env, request });
      }
    } else if (path === '/api/ai-advice') {
      if (request.method === 'POST') {
        return await aiAdviceHandler({ env, request });
      }
    } else if (path === '/api/save-view') {
      if (request.method === 'POST') {
        return await saveViewPostHandler({ env, request });
      } else if (request.method === 'GET') {
        return await saveViewGetHandler({ env, request });
      }
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
