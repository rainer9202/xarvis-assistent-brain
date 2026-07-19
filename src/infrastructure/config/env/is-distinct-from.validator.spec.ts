import { validateSync } from 'class-validator';
import { IsString } from 'class-validator';
import { IsDistinctFrom } from './is-distinct-from.validator';

class Fixture {
  @IsString()
  a: string;

  @IsString()
  @IsDistinctFrom('a')
  b: string;
}

describe('IsDistinctFrom', () => {
  it('passes validation when the two properties differ', () => {
    const fixture = new Fixture();
    fixture.a = 'secret-one';
    fixture.b = 'secret-two';

    const errors = validateSync(fixture);

    expect(errors).toHaveLength(0);
  });

  it('fails validation when the two properties are equal', () => {
    const fixture = new Fixture();
    fixture.a = 'same-secret';
    fixture.b = 'same-secret';

    const errors = validateSync(fixture);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('b');
    expect(errors[0].constraints).toEqual({
      IsDistinctFrom: 'b must be distinct from a',
    });
  });
});
