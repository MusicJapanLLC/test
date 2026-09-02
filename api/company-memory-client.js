// ============================================================================
// COMPANY MEMORY CLIENT
// Edge Function との通信 + 外部データソース連携
// ============================================================================

export class CompanyMemoryClient {
  constructor(config = {}) {
    this.supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL || 'http://localhost:54321';
    this.supabaseKey = config.supabaseKey || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    this.functionUrl = `${this.supabaseUrl}/functions/v1/memory-query`;
    this.restUrl = `${this.supabaseUrl}/rest/v1`;
    this.queryLog = [];
  }

  /**
   * Query Company Memory via Edge Function
   */
  async queryMemory(question) {
    try {
      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question })
      });

      if (!response.ok) {
        throw new Error(`Memory query failed: ${response.status}`);
      }

      const result = await response.json();
      this.queryLog.push({
        question,
        timestamp: new Date().toISOString(),
        status: 'SUCCESS',
        result
      });

      return result;
    } catch (err) {
      this.queryLog.push({
        question,
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Direct RPC call to cm_person_brief
   */
  async personBrief(name) {
    try {
      const response = await fetch(`${this.restUrl}/rpc/cm_person_brief`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'apikey': this.supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_name: name })
      });

      if (!response.ok) {
        throw new Error(`Person brief failed: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`Person brief error for "${name}":`, err.message);
      throw err;
    }
  }

  /**
   * Memory search by query
   */
  async searchMemory(query, limit = 20) {
    try {
      const response = await fetch(`${this.restUrl}/rpc/cm_memory_search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'apikey': this.supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_query: query, p_limit: limit })
      });

      if (!response.ok) {
        throw new Error(`Memory search failed: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`Memory search error for "${query}":`, err.message);
      throw err;
    }
  }

  /**
   * Record materialized fact
   */
  async recordMaterialized(personId, materialized) {
    try {
      const response = await fetch(`${this.restUrl}/rpc/cm_record_materialized`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'apikey': this.supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_person_id: personId,
          p_materialized: materialized
        })
      });

      if (!response.ok) {
        throw new Error(`Materialization recording failed: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`Materialization record error:`, err.message);
      throw err;
    }
  }

  /**
   * Batch query multiple persons
   */
  async batchQuery(questions) {
    const results = [];
    for (const q of questions) {
      try {
        const result = await this.queryMemory(q);
        results.push(result);
      } catch (err) {
        results.push({ error: err.message });
      }
    }
    return results;
  }

  /**
   * Get query statistics
   */
  getQueryStats() {
    return {
      total_queries: this.queryLog.length,
      successful: this.queryLog.filter(q => q.status === 'SUCCESS').length,
      failed: this.queryLog.filter(q => q.status === 'FAILED').length,
      recent: this.queryLog.slice(-5)
    };
  }
}

// ============================================================================
// EXTERNAL DATA SOURCES
// Google Sheets, Calendar, Slack連携
// ============================================================================

export class ExternalDataConnector {
  constructor(config = {}) {
    this.sources = {
      googleSheets: config.googleSheetsConfig || null,
      googleCalendar: config.googleCalendarConfig || null,
      slack: config.slackConfig || null,
      github: config.githubConfig || null
    };
    this.syncLog = [];
  }

  /**
   * Sync from Google Sheets
   */
  async syncGoogleSheets(sheetId, range) {
    try {
      // Mock implementation - would use google-auth-library in production
      const mockData = {
        range,
        values: [
          ['名前', '最終更新', 'ステータス'],
          ['岡藤さん', '2026-09-02', 'active'],
          ['山田太郎', '2026-09-01', 'in_progress']
        ]
      };

      this.syncLog.push({
        source: 'GOOGLE_SHEETS',
        timestamp: new Date().toISOString(),
        rows: mockData.values.length,
        status: 'SUCCESS'
      });

      return mockData;
    } catch (err) {
      this.syncLog.push({
        source: 'GOOGLE_SHEETS',
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Sync from Google Calendar
   */
  async syncGoogleCalendar(calendarId, timeMin, timeMax) {
    try {
      // Mock implementation
      const mockEvents = {
        events: [
          {
            id: 'event_1',
            summary: '岡藤さんとのミーティング',
            start: { dateTime: '2026-09-02T10:00:00Z' },
            attendees: [{ email: 'okafuji@example.com' }]
          }
        ]
      };

      this.syncLog.push({
        source: 'GOOGLE_CALENDAR',
        timestamp: new Date().toISOString(),
        events: mockEvents.events.length,
        status: 'SUCCESS'
      });

      return mockEvents;
    } catch (err) {
      this.syncLog.push({
        source: 'GOOGLE_CALENDAR',
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Sync from Slack
   */
  async syncSlackMessages(channelId, limit = 50) {
    try {
      // Mock implementation
      const mockMessages = {
        messages: [
          {
            ts: '1693689600',
            user: 'U123456',
            text: '岡藤さんのステータス: 本商談中'
          }
        ]
      };

      this.syncLog.push({
        source: 'SLACK',
        timestamp: new Date().toISOString(),
        messages: mockMessages.messages.length,
        status: 'SUCCESS'
      });

      return mockMessages;
    } catch (err) {
      this.syncLog.push({
        source: 'SLACK',
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Unified daily sync
   */
  async runDailySync() {
    const syncResult = {
      timestamp: new Date().toISOString(),
      sources: {}
    };

    // Sync all sources
    try {
      syncResult.sources.sheets = await this.syncGoogleSheets('sheets_123', 'A1:C100');
    } catch (err) {
      syncResult.sources.sheets = { error: err.message };
    }

    try {
      syncResult.sources.calendar = await this.syncGoogleCalendar('calendar_123', null, null);
    } catch (err) {
      syncResult.sources.calendar = { error: err.message };
    }

    try {
      syncResult.sources.slack = await this.syncSlackMessages('channel_123');
    } catch (err) {
      syncResult.sources.slack = { error: err.message };
    }

    return syncResult;
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return {
      total_syncs: this.syncLog.length,
      by_source: this.groupBySource(),
      recent: this.syncLog.slice(-10)
    };
  }

  groupBySource() {
    const groups = {};
    for (const log of this.syncLog) {
      if (!groups[log.source]) groups[log.source] = { success: 0, failed: 0 };
      if (log.status === 'SUCCESS') groups[log.source].success++;
      else groups[log.source].failed++;
    }
    return groups;
  }
}

// ============================================================================
// UNIFIED MEMORY SYSTEM
// Company Memory + External Sources + Agent Bridge
// ============================================================================

export class UnifiedMemorySystem {
  constructor(config = {}) {
    this.memoryClient = new CompanyMemoryClient(config.memory);
    this.dataConnector = new ExternalDataConnector(config.external);
    this.integrationLog = [];
  }

  /**
   * Materialize external data into improvements
   */
  async materializeExternalData() {
    const improvements = [];

    try {
      // Sync external sources
      const syncResult = await this.dataConnector.runDailySync();

      // Extract facts from Google Sheets
      if (syncResult.sources.sheets?.values) {
        for (const row of syncResult.sources.sheets.values.slice(1)) {
          improvements.push({
            type: 'KNOWLEDGE_UPDATE',
            source: 'EXTERNAL_DATA_SHEETS',
            description: `Person sync: ${row[0]}`,
            data: { name: row[0], status: row[2], updated: row[1] }
          });
        }
      }

      // Extract facts from Calendar events
      if (syncResult.sources.calendar?.events) {
        for (const event of syncResult.sources.calendar.events) {
          improvements.push({
            type: 'KNOWLEDGE_UPDATE',
            source: 'EXTERNAL_DATA_CALENDAR',
            description: `Calendar event: ${event.summary}`,
            data: event
          });
        }
      }

      // Extract facts from Slack messages
      if (syncResult.sources.slack?.messages) {
        for (const msg of syncResult.sources.slack.messages) {
          improvements.push({
            type: 'KNOWLEDGE_UPDATE',
            source: 'EXTERNAL_DATA_SLACK',
            description: `Slack update: ${msg.text.substring(0, 50)}`,
            data: msg
          });
        }
      }

      this.integrationLog.push({
        timestamp: new Date().toISOString(),
        type: 'MATERIALIZATION',
        improvements_created: improvements.length,
        status: 'SUCCESS'
      });

      return improvements;
    } catch (err) {
      this.integrationLog.push({
        timestamp: new Date().toISOString(),
        type: 'MATERIALIZATION',
        status: 'FAILED',
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Query memory with fallback to external sources
   */
  async queryWithFallback(question) {
    try {
      // Try Company Memory first
      return await this.memoryClient.queryMemory(question);
    } catch (err) {
      console.log(`Memory query failed, falling back to external sources: ${err.message}`);

      // Fallback to external sources
      const syncResult = await this.dataConnector.runDailySync();
      return {
        question,
        status: 'fallback_to_external',
        data: syncResult
      };
    }
  }

  /**
   * Get unified system statistics
   */
  getSystemStats() {
    return {
      timestamp: new Date().toISOString(),
      memory: this.memoryClient.getQueryStats(),
      external_sync: this.dataConnector.getSyncStats(),
      integrations: this.integrationLog.length,
      recent_integrations: this.integrationLog.slice(-5)
    };
  }
}

export default {
  CompanyMemoryClient,
  ExternalDataConnector,
  UnifiedMemorySystem
};
