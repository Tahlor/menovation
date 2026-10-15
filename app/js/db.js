/**
 * Menovation Offline IndexedDB Layer
 * Handles local-first storage for user profile, symptom logs, workouts, and the sync mutation outbox.
 */

const DB_NAME = 'menovation_offline_db';
const DB_VERSION = 3;

class MenovationDB {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // User session & profile store
        if (!db.objectStoreNames.contains('user_profile')) {
          db.createObjectStore('user_profile', { keyPath: 'id' });
        }

        // Symptom tracking entries
        if (!db.objectStoreNames.contains('symptom_logs')) {
          const symptomStore = db.createObjectStore('symptom_logs', { keyPath: 'id', autoIncrement: true });
          symptomStore.createIndex('date', 'date', { unique: false });
        }

        // Workout completion & performance logs
        let workoutStore;
        if (!db.objectStoreNames.contains('workout_logs')) {
          workoutStore = db.createObjectStore('workout_logs', { keyPath: 'id', autoIncrement: true });
          workoutStore.createIndex('date', 'date', { unique: false });
        } else {
          workoutStore = event.target.transaction.objectStore('workout_logs');
        }
        if (!workoutStore.indexNames.contains('workoutId')) {
          workoutStore.createIndex('workoutId', 'workoutId', { unique: false });
        }

        // Completed workouts state
        if (!db.objectStoreNames.contains('completed_workouts')) {
          db.createObjectStore('completed_workouts', { keyPath: 'workoutId' });
        }

        // App settings (e.g. preferred media server host)
        if (!db.objectStoreNames.contains('app_settings')) {
          db.createObjectStore('app_settings', { keyPath: 'key' });
        }

        // Mutation sync outbox (events queued while offline)
        if (!db.objectStoreNames.contains('sync_outbox')) {
          const outboxStore = db.createObjectStore('sync_outbox', { keyPath: 'id', autoIncrement: true });
          outboxStore.createIndex('status', 'status', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB Error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async put(storeName, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Specialized Outbox Methods ---
  async queueMutation(endpoint, method, payload) {
    const entry = {
      endpoint,
      method,
      payload,
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0
    };
    return await this.put('sync_outbox', entry);
  }

  async getPendingMutations() {
    const all = await this.getAll('sync_outbox');
    return all.filter(item => item.status === 'pending');
  }

  // --- Workout Performance & Notes Methods ---
  async getWorkoutLogs(workoutId = null) {
    const all = await this.getAll('workout_logs');
    if (!workoutId) {
      return all.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    }
    return all
      .filter(log => String(log.workoutId) === String(workoutId))
      .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
  }

  async getLatestWorkoutLog(workoutId) {
    const logs = await this.getWorkoutLogs(workoutId);
    return logs.length > 0 ? logs[0] : null;
  }

  async saveWorkoutLog(logData) {
    if (!logData.date) logData.date = new Date().toISOString();
    if (!logData.createdAt) logData.createdAt = new Date().toISOString();
    
    // Save to workout_logs history store
    const id = await this.put('workout_logs', logData);
    
    // Also mirror to completed_workouts for fast lastLog lookup & server sync
    const wid = String(logData.workoutId);
    const existing = await this.get('completed_workouts', wid) || {};
    await this.put('completed_workouts', {
      ...existing,
      workoutId: wid,
      title: logData.title || existing.title || ('Workout ' + wid),
      programId: logData.programId || existing.programId || null,
      completedAt: logData.date,
      lastLog: {
        ...logData,
        id: id
      }
    });
    return id;
  }

  async deleteWorkoutLog(id) {
    return await this.delete('workout_logs', id);
  }
}

// Global instance
window.mvnDB = new MenovationDB();
