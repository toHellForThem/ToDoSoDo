/**
 * Типы слоя синхронизации.
 *
 * `SyncMode` определяет, куда уходят изменения: в local-режиме они
 * накапливаются в outbox, в auth-режиме — сразу отправляются на сервер.
 */

export type { OutboxRecord } from '../utils/storage';

export type SyncMode = 'local' | 'auth';
