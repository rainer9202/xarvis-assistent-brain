import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import request from 'supertest';
import { createAuthenticatedUser, createTestApp } from '../utils/test-app';

describe('MovementType (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ cookie } = await createAuthenticatedUser(app));
  });

  afterAll(async () => {
    await prisma.movementType.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('🔍 rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/movement-types').expect(401);
  });

  it('GET /movement-types returns the seeded default types', async () => {
    const res = await request(app.getHttpServer())
      .get('/movement-types')
      .set('Cookie', cookie)
      .expect(200);

    const names = res.body.data.map(
      (movementType: { name: string }) => movementType.name,
    );
    expect(names).toEqual(
      expect.arrayContaining(['expense', 'income', 'transfer']),
    );
  });

  it('creates and deletes a custom movement type', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/movement-types')
      .set('Cookie', cookie)
      .send({ name: `custom-${Date.now()}` })
      .expect(201);

    const id = createRes.body.data.id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .delete(`/movement-types/${id}`)
      .set('Cookie', cookie)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toEqual({ id });
      });

    createdIds.splice(createdIds.indexOf(id), 1);
  });

  it('rejects a duplicate name with 409', async () => {
    const name = `custom-${Date.now()}`;
    const createRes = await request(app.getHttpServer())
      .post('/movement-types')
      .set('Cookie', cookie)
      .send({ name })
      .expect(201);
    createdIds.push(createRes.body.data.id);

    await request(app.getHttpServer())
      .post('/movement-types')
      .set('Cookie', cookie)
      .send({ name })
      .expect(409);
  });

  it('🔍 refuses to delete a default seeded movement type', async () => {
    const seeded = await prisma.movementType.findFirstOrThrow({
      where: { name: 'expense' },
    });

    await request(app.getHttpServer())
      .delete(`/movement-types/${seeded.id}`)
      .set('Cookie', cookie)
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain(
          'Default movement types cannot be deleted',
        );
      });
  });

  it('🔍 returns 404 for a nonexistent movement type id', async () => {
    await request(app.getHttpServer())
      .delete('/movement-types/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookie)
      .expect(404);
  });
});
