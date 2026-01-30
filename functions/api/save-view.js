// Save view to KV storage
export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json();
    const { filters, name } = body;

    if (!filters) {
      return Response.json({
        ok: false,
        error: 'Filters are required'
      }, { status: 400 });
    }

    const viewId = `view_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const viewData = {
      id: viewId,
      name: name || `View ${new Date().toLocaleString()}`,
      filters,
      createdAt: new Date().toISOString()
    };

    // Save to KV
    await env.SAVED_VIEWS.put(viewId, JSON.stringify(viewData));

    // Also maintain a list of all view IDs
    const viewsList = await env.SAVED_VIEWS.get('views_list');
    const views = viewsList ? JSON.parse(viewsList) : [];
    views.push(viewId);
    await env.SAVED_VIEWS.put('views_list', JSON.stringify(views));

    return Response.json({
      ok: true,
      viewId,
      view: viewData
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
}

// Get saved view
export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const viewId = url.searchParams.get('id');

    if (viewId) {
      // Get specific view
      const viewData = await env.SAVED_VIEWS.get(viewId);
      if (!viewData) {
        return Response.json({
          ok: false,
          error: 'View not found'
        }, { status: 404 });
      }
      return Response.json({
        ok: true,
        view: JSON.parse(viewData)
      });
    } else {
      // Get all views
      const viewsList = await env.SAVED_VIEWS.get('views_list');
      if (!viewsList) {
        return Response.json({
          ok: true,
          views: []
        });
      }

      const viewIds = JSON.parse(viewsList);
      const views = [];
      for (const id of viewIds) {
        const viewData = await env.SAVED_VIEWS.get(id);
        if (viewData) {
          views.push(JSON.parse(viewData));
        }
      }

      return Response.json({
        ok: true,
        views: views.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      });
    }
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
}
