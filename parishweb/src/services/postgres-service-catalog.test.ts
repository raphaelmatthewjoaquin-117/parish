import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresServiceField,
  deletePostgresServiceField,
  listPostgresAdminServiceFields,
  listPostgresServiceFields,
  listPostgresServices,
  updatePostgresServiceField,
} from './postgres-service-catalog.js';

describe('PostgreSQL service catalog repository', () => {
  it('returns active services ordered by name in the public API shape', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { id: 2, name: 'Baptism', description: 'Baptism service' },
        ],
      }),
    };

    await expect(listPostgresServices(pool)).resolves.toEqual([
      { id: 2, name: 'Baptism', description: 'Baptism service' },
    ]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('"IsActive" = TRUE'));
  });

  it('returns active dynamic fields with parsed options and boolean required flags', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          key: 'churchRecord',
          label: 'Church record',
          type: 'select',
          optionsJson: '["Yes","No"]',
          required: true,
        }],
      }),
    };

    await expect(listPostgresServiceFields(pool, 2)).resolves.toEqual({
      fields: [{
        key: 'churchRecord',
        label: 'Church record',
        type: 'select',
        options: ['Yes', 'No'],
        required: true,
      }],
    });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('"ServiceId" = $1 AND "IsActive" = TRUE'),
      [2],
    );
  });

  it('lists all admin service fields with decoded options and service names', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          id: 8,
          serviceId: 2,
          serviceName: 'Baptism',
          key: 'churchRecord',
          label: 'Church record',
          type: 'select',
          optionsJson: '["Yes","No"]',
          required: true,
          sortOrder: 3,
          active: false,
        }],
      }),
    };

    await expect(listPostgresAdminServiceFields(pool)).resolves.toEqual([{
      id: 8,
      serviceId: 2,
      serviceName: 'Baptism',
      key: 'churchRecord',
      label: 'Church record',
      type: 'select',
      options: ['Yes', 'No'],
      required: true,
      sortOrder: 3,
      active: false,
    }]);
  });

  it('creates a service field and returns its generated ID', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: 21 }], rowCount: 1 }),
    };

    await expect(createPostgresServiceField(pool, {
      serviceId: 2,
      key: 'churchRecord',
      label: 'Church record',
      type: 'select',
      optionsJson: '["Yes","No"]',
      required: true,
      sortOrder: 3,
      active: true,
    })).resolves.toBe(21);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "public"."ServiceFieldDefinition"'),
      [2, 'churchRecord', 'Church record', 'select', '["Yes","No"]', true, 3, true],
    );
  });

  it('fails if the database does not return the created service field ID', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };

    await expect(createPostgresServiceField(pool, {
      serviceId: 2,
      key: 'churchRecord',
      label: 'Church record',
      type: 'text',
      optionsJson: null,
      required: false,
      sortOrder: 0,
      active: true,
    })).rejects.toThrow('PostgreSQL did not return the created service field ID.');
  });

  it('updates and deletes service fields using parameterized IDs', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };

    await expect(updatePostgresServiceField(pool, 21, {
      label: 'Updated label',
      type: 'text',
      optionsJson: null,
      required: false,
      sortOrder: 4,
      active: false,
    })).resolves.toBe(true);
    await expect(deletePostgresServiceField(pool, 21)).resolves.toBe(true);
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE "public"."ServiceFieldDefinition"'),
      [21, 'Updated label', 'text', null, false, 4, false],
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM "public"."ServiceFieldDefinition"'),
      [21],
    );
  });
});
