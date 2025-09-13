import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server/app';

describe('API integration', () => {
  const suffix = Math.random().toString(36).slice(2,10);
  it('health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
  let groupId: string;
  it('create group', async () => {
    const res = await request(app).post('/api/groups').send({ name: 'Test Group', startsOn: '2025-01-01T00:00:00.000Z', endsOn: '2025-02-01T00:00:00.000Z' });
    expect(res.status).toBe(201);
    groupId = res.body.id;
    expect(res.body.endsOn).toBeTruthy();
  });
  it('patch group valid endsOn', async () => {
    const res = await request(app).patch(`/api/groups/${groupId}`).send({ endsOn: '2025-03-01T00:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(new Date(res.body.endsOn).toISOString()).toBe('2025-03-01T00:00:00.000Z');
  });
  it('patch group invalid ordering', async () => {
    const res = await request(app).patch(`/api/groups/${groupId}`).send({ startsOn: '2025-04-01T00:00:00.000Z', endsOn: '2025-03-01T00:00:00.000Z' });
    expect(res.status).toBe(400);
  });
  let studentId: string;
  it('create student', async () => {
    const res = await request(app).post('/api/students').send({ firstName:'Jane', lastName:'Doe', username:`janedoe_${suffix}`, email:`jane+${suffix}@example.com`, passwordPlaintext:'Password123!' });
    expect(res.status).toBe(201);
    studentId = res.body.id;
  });
  it('assign group', async () => {
    const res = await request(app).post(`/api/students/${studentId}/assign-group`).send({ groupId });
    expect(res.status).toBe(200);
    expect(res.body.groupId).toBe(groupId);
  });
  it('unassign group', async () => {
    const res = await request(app).post(`/api/students/${studentId}/assign-group`).send({ groupId: null });
    expect(res.status).toBe(200);
    expect(res.body.groupId).toBeNull();
  });
  it('password change', async () => {
    const res = await request(app).patch(`/api/students/${studentId}`).send({ newPasswordPlaintext:'NewPassword123!' });
    expect(res.status).toBe(200);
  });
});
