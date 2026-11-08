import { describe, expect, it } from 'vitest';
import {
  createPostgresEvent,
  deletePostgresEvent,
  listPostgresEvents,
  updatePostgresEvent,
} from './postgres-events.js';

describe('PostgreSQL events', () => {
  it('maps public event rows to the existing API shape', async () => {
    const pool = {
      query: async () => ({
        rows: [{
          EventId: 7,
          Title: 'Test parish event',
          TitleTl: 'Pagsubok na event',
          Description: 'Clearly labeled test content',
          DescriptionTl: '',
          Body: 'Details',
          BodyTl: '',
          EventDate: '2026-11-09',
          EventTime: '10:30:00',
          Location: 'Test venue',
          LocationTl: '',
          PhotoUrl: '',
        }],
        rowCount: 1,
      }),
    };

    await expect(listPostgresEvents(pool)).resolves.toEqual([{
      id: '7',
      title: 'Test parish event',
      titleTl: 'Pagsubok na event',
      description: 'Clearly labeled test content',
      descriptionTl: '',
      detail: 'Details',
      detailTl: '',
      date: '2026-11-09',
      time: '10:30:00',
      location: 'Test venue',
      locationTl: '',
      photoUrl: '',
    }]);
  });

  it('binds event data as parameters when creating an event', async () => {
    const input = {
      title: "Test'); DROP TABLE \"Events\";--",
      titleTl: '',
      description: 'Test content',
      descriptionTl: '',
      detail: '',
      detailTl: '',
      date: '2026-11-09',
      time: '',
      location: '',
      locationTl: '',
      photoUrl: '',
    };
    let received: { text: string; values: unknown[] } | undefined;
    const pool = {
      query: async (text: string, values: unknown[] = []) => {
        received = { text, values };
        return { rows: [{ EventId: 8, Title: input.title, EventDate: input.date }], rowCount: 1 };
      },
    };

    await createPostgresEvent(pool, input);

    expect(received?.text).toContain('VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)');
    expect(received?.text).not.toContain(input.title);
    expect(received?.values).toEqual([
      input.title, '', 'Test content', '', '', '', '2026-11-09', null, null, '', '',
    ]);
  });

  it('returns null when an event to update does not exist', async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) };

    await expect(updatePostgresEvent(pool, 999, {
      title: 'Test event',
      titleTl: '',
      description: '',
      descriptionTl: '',
      detail: '',
      detailTl: '',
      date: '2026-11-09',
      time: '',
      location: '',
      locationTl: '',
      photoUrl: '',
    })).resolves.toBeNull();
  });

  it('reports whether an event was deleted', async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) };

    await expect(deletePostgresEvent(pool, 999)).resolves.toBe(false);
  });
});
