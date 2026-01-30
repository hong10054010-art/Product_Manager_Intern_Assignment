export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json();
    const { filters, chartData } = body;

    // Get top themes and insights from the data
    const topTheme = chartData.byTheme?.[0];
    const topPlatform = chartData.byPlatform?.reduce((a, b) => 
      a.count > b.count ? a : b, chartData.byPlatform[0]
    );
    const topProduct = chartData.byProduct?.reduce((a, b) => 
      a.count > b.count ? a : b, chartData.byProduct[0]
    );
    const totalCount = chartData.totalCount || 0;

    // Prepare context for AI
    const context = `
      Feedback Analysis Summary:
      - Total feedback count: ${totalCount}
      - Top theme: ${topTheme?.key || 'N/A'} (${topTheme?.count || 0} occurrences)
      - Top platform: ${topPlatform?.key || 'N/A'} (${topPlatform?.count || 0} occurrences)
      - Top product: ${topProduct?.key || 'N/A'} (${topProduct?.count || 0} occurrences)
      - Sentiment distribution: ${JSON.stringify(chartData.bySentiment || [])}
      - Urgency distribution: ${JSON.stringify(chartData.byUrgency || [])}
      - Value distribution: ${JSON.stringify(chartData.byValue || [])}
      
      Current filters:
      - Product: ${filters.product || 'All'}
      - Platform: ${filters.platform || 'All'}
      - Country: ${filters.country || 'All'}
      - Time Range: ${filters.timeRange || '30'} days
    `;

    // Use Workers AI to generate recommendations
    try {
      // Check if AI binding is available
      if (!env.AI) {
        throw new Error('Workers AI is not configured. Please check your wrangler.toml file.');
      }

      const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are a product management assistant. Analyze feedback data and provide actionable recommendations. Focus on themes, urgency, value, and sentiment. Provide 3-5 specific, actionable recommendations in a clear format.'
          },
          {
            role: 'user',
            content: `Based on this feedback analysis, provide strategic recommendations for the product team:\n\n${context}`
          }
        ],
        max_tokens: 500
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
    
      // Extract recommendations (split by numbered points or bullet points)
      const recommendations = aiText
        .split(/\d+\.|\n-|\n\*|##|###/)
        .filter(item => item.trim().length > 20)
        .slice(0, 5)
        .map(item => item.trim().replace(/^[\d\.\-\*\#\s]+/, '').trim())
        .filter(Boolean);

      // If AI didn't provide structured output, create structured recommendations
      const adviceItems = recommendations.length > 0 ? recommendations.map((rec, idx) => ({
        title: `Recommendation ${idx + 1}`,
        text: rec
      })) : [
      {
        title: 'Priority Action',
        text: topTheme ? `Address "${topTheme.key}" theme immediately - it represents ${((topTheme.count / totalCount) * 100).toFixed(1)}% of all feedback. Consider creating a dedicated task force.` : 'Review top themes and prioritize action items.'
      },
      {
        title: 'Platform Focus',
        text: topPlatform ? `${topPlatform.key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} is the primary feedback source. Enhance monitoring and response time for this channel.` : 'Monitor all feedback channels consistently.'
      },
      {
        title: 'Product Recommendation',
        text: topProduct ? `${topProduct.key} shows the highest feedback volume. Review recent changes and consider user education or feature improvements.` : 'Review product feedback distribution and identify improvement areas.'
      },
      {
        title: 'Strategic Insight',
        text: `Based on sentiment analysis, focus on areas with negative sentiment and replicate success patterns from positive feedback.`
      }
    ];

      return Response.json({
        ok: true,
        advice: adviceItems,
        aiResponse: aiText
      });
    } catch (aiError) {
      console.error('AI Processing Error:', aiError);
      const errorMessage = aiError.message || String(aiError);
      
      // Check if it's a quota/limit error
      if (errorMessage.includes('limit') || errorMessage.includes('quota') || errorMessage.includes('exceeded')) {
        return Response.json({
          ok: true,
          advice: [
            {
              title: 'AI Service Limit Reached',
              text: 'Workers AI daily limit has been reached. Please upgrade your plan or try again tomorrow. Using rule-based recommendations instead.'
            },
            {
              title: 'Priority Action',
              text: topTheme ? `Address "${topTheme.key}" theme immediately - it represents ${((topTheme.count / totalCount) * 100).toFixed(1)}% of all feedback. Consider creating a dedicated task force.` : 'Review top themes and prioritize action items.'
            },
            {
              title: 'Platform Focus',
              text: topPlatform ? `${topPlatform.key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} is the primary feedback source. Enhance monitoring and response time for this channel.` : 'Monitor all feedback channels consistently.'
            },
            {
              title: 'Product Recommendation',
              text: topProduct ? `${topProduct.key} shows the highest feedback volume. Review recent changes and consider user education or feature improvements.` : 'Review product feedback distribution and identify improvement areas.'
            }
          ],
          error: 'AI quota exceeded',
          fallback: true
        });
      }
      // Fall through to rule-based recommendations
    }
  } catch (error) {
    console.error('AI Advice Error:', error);
    const errorMessage = error.message || String(error);
    
    // Fallback to rule-based recommendations
    return Response.json({
      ok: true,
      advice: [
        {
          title: 'Data Analysis',
          text: 'Analyze the feedback patterns and identify common themes across different platforms and products.'
        },
        {
          title: 'Priority Focus',
          text: 'Focus on high-urgency and high-value feedback items to maximize impact.'
        },
        {
          title: 'Sentiment Monitoring',
          text: 'Monitor sentiment trends and address negative feedback proactively.'
        }
      ],
      error: errorMessage,
      fallback: true
    });
  }
}
