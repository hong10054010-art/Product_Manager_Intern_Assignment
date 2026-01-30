export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const source = url.searchParams.get("platform") || url.searchParams.get("source");
  const product = url.searchParams.get("product");
  const country = url.searchParams.get("country");
  const timeRange = url.searchParams.get("timeRange") || "30";
  
  // Calculate date range based on timeRange parameter
  // Use UTC to avoid timezone issues
  const now = new Date();
  const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  let fromDate = new Date(nowUTC);
  
  if (timeRange === "7") {
    fromDate.setUTCDate(nowUTC.getUTCDate() - 7);
  } else if (timeRange === "30") {
    fromDate.setUTCDate(nowUTC.getUTCDate() - 30);
  } else if (timeRange === "90") {
    fromDate.setUTCDate(nowUTC.getUTCDate() - 90);
  } else if (timeRange === "365") {
    fromDate.setUTCDate(nowUTC.getUTCDate() - 365);
  } else {
    fromDate = new Date(0); // All time
  }
  

  const where = [];
  const args = [];

  if (source) {
    // Support comma-separated values for multiple selection
    if (source.includes(',')) {
      const sources = source.split(',').map(s => s.trim()).filter(s => s);
      if (sources.length > 0) {
        const placeholders = sources.map(() => '?').join(',');
        where.push(`r.source IN (${placeholders})`);
        args.push(...sources);
      }
    } else {
      where.push("r.source = ?");
      args.push(source);
    }
  }
  if (product) {
    // Support comma-separated values for multiple selection
    if (product.includes(',')) {
      const products = product.split(',').map(p => p.trim()).filter(p => p);
      if (products.length > 0) {
        const placeholders = products.map(() => '?').join(',');
        where.push(`r.product_area IN (${placeholders})`);
        args.push(...products);
      }
    } else {
      where.push("r.product_area = ?");
      args.push(product);
    }
  }
  if (country) {
    // Support comma-separated values for multiple selection
    if (country.includes(',')) {
      const countries = country.split(',').map(c => c.trim()).filter(c => c);
      if (countries.length > 0) {
        const placeholders = countries.map(() => '?').join(',');
        where.push(`r.country IN (${placeholders})`);
        args.push(...countries);
      }
    } else {
      where.push("r.country = ?");
      args.push(country);
    }
  }
  if (timeRange !== "all") {
    // Format date as ISO string for comparison
    // Since created_at is stored as ISO string (YYYY-MM-DDTHH:mm:ss.sssZ),
    // we compare directly as strings - ISO format is lexicographically sortable
    const fromDateISO = fromDate.toISOString();
    where.push("r.created_at >= ?"); 
    args.push(fromDateISO); 
  }

  const whereSql = where.length ? ("WHERE " + where.join(" AND ")) : "";

  // Debug: Log query details
  console.log(`[Query] timeRange: ${timeRange}, fromDate: ${fromDate.toISOString()}, whereSql: ${whereSql}, args:`, args);

  // Total count
  const totalCountResult = await env.DB
    .prepare(`SELECT COUNT(*) as count FROM raw_feedback r ${whereSql}`)
    .bind(...args)
    .first();
  
  console.log(`[Query] Total count for ${timeRange} days:`, totalCountResult?.count);

  // By Theme
  const byTheme = await env.DB
    .prepare(
      `SELECT IFNULL(e.theme, 'unclassified') AS key, COUNT(*) AS count
       FROM raw_feedback r
       LEFT JOIN enriched_feedback e ON r.id = e.id
       ${whereSql}
       GROUP BY key
       ORDER BY count DESC
       LIMIT 10`
    )
    .bind(...args)
    .all();

  // By Platform (Source)
  const byPlatform = await env.DB
    .prepare(
      `SELECT r.source AS key, COUNT(*) AS count
       FROM raw_feedback r
       ${whereSql}
       GROUP BY r.source
       ORDER BY count DESC`
    )
    .bind(...args)
    .all();

  // By Country
  const byCountry = await env.DB
    .prepare(
      `SELECT r.country AS key, COUNT(*) AS count
       FROM raw_feedback r
       ${whereSql}
       GROUP BY r.country
       ORDER BY count DESC`
    )
    .bind(...args)
    .all();

  // By Product
  const byProduct = await env.DB
    .prepare(
      `SELECT r.product_area AS key, COUNT(*) AS count
       FROM raw_feedback r
       ${whereSql}
       GROUP BY r.product_area
       ORDER BY count DESC`
    )
    .bind(...args)
    .all();

  // By Time (daily for the selected range)
  const byTime = await env.DB
    .prepare(
      `SELECT date(r.created_at) AS key, COUNT(*) AS count
       FROM raw_feedback r
       ${whereSql}
       GROUP BY date(r.created_at)
       ORDER BY key ASC`
    )
    .bind(...args)
    .all();

  // By Sentiment
  const bySentiment = await env.DB
    .prepare(
      `SELECT IFNULL(e.sentiment, 'neutral') AS key, COUNT(*) AS count
       FROM raw_feedback r
       LEFT JOIN enriched_feedback e ON r.id = e.id
       ${whereSql}
       GROUP BY key
       ORDER BY count DESC`
    )
    .bind(...args)
    .all();

  // By Urgency
  const byUrgency = await env.DB
    .prepare(
      `SELECT IFNULL(e.urgency, 'medium') AS key, COUNT(*) AS count
       FROM raw_feedback r
       LEFT JOIN enriched_feedback e ON r.id = e.id
       ${whereSql}
       GROUP BY key
       ORDER BY 
         CASE IFNULL(e.urgency, 'medium')
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END`
    )
    .bind(...args)
    .all();

  // By Value
  const byValue = await env.DB
    .prepare(
      `SELECT IFNULL(e.value, 'medium') AS key, COUNT(*) AS count
       FROM raw_feedback r
       LEFT JOIN enriched_feedback e ON r.id = e.id
       ${whereSql}
       GROUP BY key
       ORDER BY count DESC`
    )
    .bind(...args)
    .all();

  return Response.json({
    ok: true,
    filters: { source, product, country, timeRange },
    totalCount: totalCountResult?.count || 0,
    charts: {
      byTheme: byTheme.results || [],
      byPlatform: byPlatform.results || [],
      byCountry: byCountry.results || [],
      byProduct: byProduct.results || [],
      byTime: byTime.results || [],
      bySentiment: bySentiment.results || [],
      byUrgency: byUrgency.results || [],
      byValue: byValue.results || []
    }
  });
}
