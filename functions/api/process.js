// This worker processes raw feedback from R2, enriches it with AI, and stores in D1
export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json();
    const { feedbackId, batchSize = 10 } = body;

    // If specific feedback ID provided, process that one
    if (feedbackId) {
      return await processSingleFeedback(env, feedbackId);
    }

    // Otherwise, process a batch of unprocessed feedback
    const unprocessed = await env.DB
      .prepare(
        `SELECT r.* FROM raw_feedback r
         LEFT JOIN enriched_feedback e ON r.id = e.id
         WHERE e.id IS NULL
         LIMIT ?`
      )
      .bind(batchSize)
      .all();

    const results = [];
    for (const feedback of unprocessed.results || []) {
      try {
        const enriched = await enrichFeedback(env, feedback);
        results.push({ id: feedback.id, success: true, enriched });
      } catch (error) {
        results.push({ id: feedback.id, success: false, error: error.message });
      }
    }

    return Response.json({
      ok: true,
      processed: results.length,
      results
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
}

async function processSingleFeedback(env, feedbackId) {
  const feedback = await env.DB
    .prepare('SELECT * FROM raw_feedback WHERE id = ?')
    .bind(feedbackId)
    .first();

  if (!feedback) {
    return Response.json({
      ok: false,
      error: 'Feedback not found'
    }, { status: 404 });
  }

  const enriched = await enrichFeedback(env, feedback);
  return Response.json({
    ok: true,
    feedback: enriched
  });
}

async function enrichFeedback(env, feedback) {
  // Use Workers AI to analyze the feedback
  let analysis;
  
  try {
    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You are a feedback analysis assistant. Analyze user feedback and extract:
1. Theme (one word or short phrase: e.g., "Performance Issues", "Documentation Requests", "Feature Requests", "Bug Reports", "Pricing Concerns", "Integration Problems", "Security Questions", "Migration Support", "API Improvements", "User Experience")
2. Sentiment (one word: positive, neutral, or negative)
3. Urgency (one word: low, medium, high, or critical)
4. Value (one word: low, medium, or high)
5. Summary (one sentence)
6. Keywords (comma-separated list of 3-5 key terms)

Respond ONLY in JSON format: {"theme": "...", "sentiment": "...", "urgency": "...", "value": "...", "summary": "...", "keywords": "..."}`
        },
        {
          role: 'user',
          content: `Analyze this feedback:\n\nProduct: ${feedback.product_area}\nSource: ${feedback.source}\nContent: ${feedback.content}`
        }
      ],
      max_tokens: 300
    });

    // Parse AI response - Workers AI returns response in different formats
    let aiText = '';
    if (typeof aiResponse === 'string') {
      aiText = aiResponse;
    } else if (aiResponse.response) {
      aiText = aiResponse.response;
    } else if (aiResponse.text) {
      aiText = aiResponse.text;
    } else if (aiResponse.choices && aiResponse.choices[0] && aiResponse.choices[0].message) {
      aiText = aiResponse.choices[0].message.content;
    } else {
      aiText = JSON.stringify(aiResponse);
    }

    // Try to extract JSON from the response
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in AI response');
    }
  } catch (error) {
    console.error('AI analysis error, using fallback:', error);
    // Fallback to rule-based analysis
    analysis = {
      theme: classifyTheme(feedback.content),
      sentiment: classifySentiment(feedback.content),
      urgency: classifyUrgency(feedback.content),
      value: 'medium',
      summary: feedback.content.substring(0, 200),
      keywords: extractKeywords(feedback.content)
    };
  }

  // Store enriched feedback in D1
  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO enriched_feedback 
       (id, theme, sentiment, urgency, value, summary, keywords, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      feedback.id,
      analysis.theme || 'unclassified',
      analysis.sentiment || 'neutral',
      analysis.urgency || 'medium',
      analysis.value || 'medium',
      analysis.summary || feedback.content.substring(0, 200),
      JSON.stringify(analysis.keywords?.split(',') || []),
      new Date().toISOString()
    )
    .run();

  // Also store raw data backup in R2
  try {
    await env.R2_BUCKET.put(
      `raw-feedback/${feedback.id}.json`,
      JSON.stringify(feedback),
      {
        httpMetadata: {
          contentType: 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('R2 storage error:', error);
  }

  return {
    id: feedback.id,
    ...analysis
  };
}

// Fallback classification functions
function classifyTheme(content) {
  const lower = content.toLowerCase();
  if (lower.includes('documentation') || lower.includes('docs') || lower.includes('guide')) {
    return 'Documentation Requests';
  }
  if (lower.includes('bug') || lower.includes('error') || lower.includes('broken') || lower.includes('fail')) {
    return 'Bug Reports';
  }
  if (lower.includes('feature') || lower.includes('add') || lower.includes('request')) {
    return 'Feature Requests';
  }
  if (lower.includes('performance') || lower.includes('slow') || lower.includes('latency')) {
    return 'Performance Issues';
  }
  if (lower.includes('price') || lower.includes('cost') || lower.includes('billing')) {
    return 'Pricing Concerns';
  }
  if (lower.includes('integration') || lower.includes('connect') || lower.includes('api')) {
    return 'Integration Problems';
  }
  if (lower.includes('security') || lower.includes('secure') || lower.includes('auth')) {
    return 'Security Questions';
  }
  if (lower.includes('migration') || lower.includes('migrate') || lower.includes('move')) {
    return 'Migration Support';
  }
  return 'User Experience';
}

function classifySentiment(content) {
  const lower = content.toLowerCase();
  const positiveWords = ['great', 'excellent', 'love', 'amazing', 'good', 'perfect', 'thanks', 'helpful'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'frustrated', 'disappointed', 'broken', 'fail'];
  
  const positiveCount = positiveWords.filter(word => lower.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lower.includes(word)).length;
  
  if (negativeCount > positiveCount) return 'negative';
  if (positiveCount > negativeCount) return 'positive';
  return 'neutral';
}

function classifyUrgency(content) {
  const lower = content.toLowerCase();
  if (lower.includes('critical') || lower.includes('urgent') || lower.includes('emergency') || lower.includes('down')) {
    return 'critical';
  }
  if (lower.includes('important') || lower.includes('asap') || lower.includes('soon')) {
    return 'high';
  }
  if (lower.includes('minor') || lower.includes('low priority') || lower.includes('nice to have')) {
    return 'low';
  }
  return 'medium';
}

function extractKeywords(content) {
  // Simple keyword extraction (in production, use better NLP)
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4)
    .filter(word => !['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would'].includes(word));
  
  const wordCounts = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
    .join(', ');
}
