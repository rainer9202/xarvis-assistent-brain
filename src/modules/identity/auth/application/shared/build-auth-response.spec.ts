import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../domain/entities/user.entity';
import { buildAuthResponse } from './build-auth-response';

describe('buildAuthResponse', () => {
  it('signs a {sub, email, name} JWT payload and returns {id, accessToken}', async () => {
    const signAsync = jest.fn().mockResolvedValue('signed-jwt-token');
    const jwtService = { signAsync } as unknown as JwtService;
    const user = new UserEntity({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'hashed-password',
    });

    const result = await buildAuthResponse(jwtService, user);

    expect(signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });
    expect(result).toEqual({ id: 'user-1', accessToken: 'signed-jwt-token' });
  });
});
