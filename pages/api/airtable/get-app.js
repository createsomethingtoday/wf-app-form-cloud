/**
 * Get App Data from Airtable by Client ID
 * GET /api/airtable/get-app?clientId=xxx
 *
 * Protected by autofillUpdate feature flag
 * Queries Airtable for existing app submission to enable auto-fill for updates
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { clientId } = req.query;

  if (!clientId) {
    return res.status(400).json({
      success: false,
      message: 'Client ID is required'
    });
  }

  try {
    // Airtable configuration
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appMoIgXMTTTNIc3p';
    const TABLE_ID = 'tblRwzpWoLgE9MrUm';

    if (!AIRTABLE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Airtable API key not configured'
      });
    }

    // Search for records with matching Client ID using field ID
    // Field ID: fldtwvVVlTeDRlTYV (more reliable than field name)
    const filterFormula = `SEARCH("${clientId}", {fldtwvVVlTeDRlTYV}) > 0`;

    let url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('Airtable query result:', {
      recordCount: data.records?.length || 0,
      filterFormula: filterFormula,
      clientId
    });

    if (!data.records || data.records.length === 0) {
      // Return more debug info
      return res.status(404).json({
        success: false,
        message: 'No app found with this Client ID',
        debug: {
          clientId,
          filterFormula: filterFormula,
          recordCount: 0
        }
      });
    }

    // Return the first matching record
    const record = data.records[0];

    res.status(200).json({
      success: true,
      app: {
        id: record.id,
        fields: record.fields,
        createdTime: record.createdTime
      }
    });

  } catch (error) {
    console.error('Airtable query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to query Airtable',
      error: error.message
    });
  }
}
