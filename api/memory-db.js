// ============================================================================
// COMPANY MEMORY DATABASE - REAL IMPLEMENTATION
// SQLite ベース、実際の永続化・クエリ機能
// ============================================================================

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../company-memory.db');

export class MemoryDatabase {
  constructor(dbPath = DB_PATH) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  /**
   * Initialize database schema
   */
  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS persons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        canonical_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL,
        fact_type TEXT NOT NULL,
        value TEXT,
        source TEXT,
        confidence REAL DEFAULT 0.8,
        valid_from TEXT,
        valid_to TEXT,
        recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(person_id) REFERENCES persons(id)
      );

      CREATE TABLE IF NOT EXISTS source_records (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL,
        source TEXT,
        external_id TEXT,
        external_version TEXT,
        content_hash TEXT,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(person_id) REFERENCES persons(id)
      );

      CREATE TABLE IF NOT EXISTS materializations (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL,
        materialized_value TEXT,
        confidence REAL,
        verified BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(person_id) REFERENCES persons(id)
      );

      CREATE INDEX IF NOT EXISTS idx_facts_person ON facts(person_id);
      CREATE INDEX IF NOT EXISTS idx_facts_type ON facts(fact_type);
      CREATE INDEX IF NOT EXISTS idx_source_person ON source_records(person_id);
    `);
  }

  /**
   * Create or get person
   */
  ensurePerson(name) {
    const id = `person_${name.replace(/\s+/g, '_')}`;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO persons (id, name, canonical_name)
        VALUES (?, ?, ?)
      `);
      stmt.run(id, name, name);
    } catch (e) {
      // Ignore duplicate key
    }

    return id;
  }

  /**
   * Record fact
   */
  recordFact(personId, factType, value, source = 'MANUAL', confidence = 0.85) {
    const id = `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO facts (id, person_id, fact_type, value, source, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, personId, factType, value, source, confidence);
    return id;
  }

  /**
   * Get person brief (all facts)
   */
  getPersonBrief(name) {
    const personId = `person_${name.replace(/\s+/g, '_')}`;

    const person = this.db.prepare(`
      SELECT id, name, canonical_name, created_at, updated_at
      FROM persons WHERE id = ?
    `).get(personId);

    if (!person) {
      return null;
    }

    const facts = this.db.prepare(`
      SELECT id, fact_type, value, source, confidence, recorded_at
      FROM facts WHERE person_id = ?
      ORDER BY recorded_at DESC
    `).all(personId);

    return {
      id: person.id,
      name: person.name,
      canonical_name: person.canonical_name,
      source_facts: facts.map(f => ({
        fact: f.fact_type,
        value: f.value,
        source: f.source,
        confidence: f.confidence,
        recorded_at: f.recorded_at
      })),
      verification_state: 'verified',
      created_at: person.created_at,
      updated_at: person.updated_at,
      as_of: new Date().toISOString()
    };
  }

  /**
   * Search persons by name
   */
  searchPersons(query, limit = 20) {
    const searchTerm = `%${query}%`;

    const results = this.db.prepare(`
      SELECT id, name, canonical_name, created_at
      FROM persons
      WHERE name LIKE ? OR canonical_name LIKE ?
      ORDER BY name
      LIMIT ?
    `).all(searchTerm, searchTerm, limit);

    return results.map(r => ({
      id: r.id,
      name: r.name,
      canonical_name: r.canonical_name,
      created_at: r.created_at,
      confidence: 0.9
    }));
  }

  /**
   * Record materialization
   */
  recordMaterialization(personId, value, confidence = 0.85) {
    const id = `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO materializations (id, person_id, materialized_value, confidence, verified)
      VALUES (?, ?, ?, ?, 1)
    `);

    stmt.run(id, personId, JSON.stringify(value), confidence);
    return id;
  }

  /**
   * Get all materializations for person
   */
  getPersonMaterializations(personId) {
    return this.db.prepare(`
      SELECT id, materialized_value, confidence, created_at, verified
      FROM materializations
      WHERE person_id = ?
      ORDER BY created_at DESC
    `).all(personId);
  }

  /**
   * Sync external source (record source record)
   */
  syncExternalSource(personId, source, externalId, externalVersion, content) {
    const recordId = `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Simple hash of content
    const contentHash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(content))
      .digest('hex');

    const stmt = this.db.prepare(`
      INSERT INTO source_records (id, person_id, source, external_id, external_version, content_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(recordId, personId, source, externalId, externalVersion, contentHash);
    return recordId;
  }

  /**
   * Get database statistics
   */
  getStats() {
    const personCount = this.db.prepare('SELECT COUNT(*) as count FROM persons').get();
    const factCount = this.db.prepare('SELECT COUNT(*) as count FROM facts').get();
    const materializationCount = this.db.prepare('SELECT COUNT(*) as count FROM materializations').get();
    const sourceCount = this.db.prepare('SELECT COUNT(*) as count FROM source_records').get();

    return {
      persons: personCount.count,
      facts: factCount.count,
      materializations: materializationCount.count,
      source_records: sourceCount.count,
      database_path: DB_PATH
    };
  }

  /**
   * Get recent activity
   */
  getRecentActivity(limit = 10) {
    const facts = this.db.prepare(`
      SELECT 'fact' as type, person_id, fact_type as description, recorded_at
      FROM facts
      ORDER BY recorded_at DESC
      LIMIT ?
    `).all(limit);

    const syncs = this.db.prepare(`
      SELECT 'sync' as type, person_id, source as description, synced_at as recorded_at
      FROM source_records
      ORDER BY synced_at DESC
      LIMIT ?
    `).all(limit);

    const mats = this.db.prepare(`
      SELECT 'materialization' as type, person_id, 'materialized' as description, created_at as recorded_at
      FROM materializations
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    return [...facts, ...syncs, ...mats]
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
      .slice(0, limit);
  }

  /**
   * Close database
   */
  close() {
    this.db.close();
  }

  /**
   * Clear all data (for testing)
   */
  clear() {
    this.db.exec(`
      DELETE FROM facts;
      DELETE FROM source_records;
      DELETE FROM materializations;
      DELETE FROM persons;
    `);
  }
}

// ============================================================================
// SEED DATA
// ============================================================================

export function seedTestData(db) {
  const person1 = db.ensurePerson('岡藤');
  const person2 = db.ensurePerson('山田太郎');
  const person3 = db.ensurePerson('佐藤花子');

  // Add facts for person 1
  db.recordFact(person1, 'status', 'active', 'MANUAL', 0.95);
  db.recordFact(person1, 'last_activity', '2026-09-02', 'SYSTEM', 0.9);
  db.recordFact(person1, 'phone', '090-XXXX-YYYY', 'SPREADSHEET', 0.85);
  db.recordFact(person1, 'email', 'okafuji@example.com', 'CALENDAR', 0.9);

  // Add facts for person 2
  db.recordFact(person2, 'status', 'in_progress', 'MANUAL', 0.9);
  db.recordFact(person2, 'project', '大規模LLMアプリ構築', 'SPREADSHEET', 0.85);
  db.recordFact(person2, 'last_update', '2026-09-01', 'SYSTEM', 0.95);

  // Add facts for person 3
  db.recordFact(person3, 'status', 'pending', 'SLACK', 0.8);
  db.recordFact(person3, 'next_action', '商談予定', 'CALENDAR', 0.85);

  // Record materializations
  db.recordMaterialization(person1, { status: 'active', engagement: 'high' }, 0.92);
  db.recordMaterialization(person2, { status: 'in_progress', priority: 'high' }, 0.88);

  return {
    persons: [person1, person2, person3],
    message: 'Test data seeded successfully'
  };
}

export default MemoryDatabase;
