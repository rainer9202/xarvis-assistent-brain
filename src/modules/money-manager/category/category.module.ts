import { Module } from '@nestjs/common';
import { MovementTypeModule } from '@modules/money-manager/movement-type/movement-type.module';
import { CreateCategoryUseCase } from './application/use-cases/create-category.use-case';
import { UpdateCategoryUseCase } from './application/use-cases/update-category.use-case';
import { DeleteCategoryUseCase } from './application/use-cases/delete-category.use-case';
import { GetAllCategoriesUseCase } from './application/use-cases/get-all-categories.use-case';
import { GetCategoryByIdUseCase } from './application/use-cases/get-category-by-id.use-case';
import { CATEGORY_REPOSITORY } from './domain/ports/category.repository.port';
import { CategoryController } from './infrastructure/controllers/category.controller';
import { PrismaCategoryRepository } from './infrastructure/repositories/prisma-category.repository';

@Module({
  imports: [MovementTypeModule],
  controllers: [CategoryController],
  providers: [
    {
      provide: CATEGORY_REPOSITORY,
      useClass: PrismaCategoryRepository,
    },
    GetAllCategoriesUseCase,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    DeleteCategoryUseCase,
    GetCategoryByIdUseCase,
  ],
  exports: [GetCategoryByIdUseCase],
})
export class CategoryModule {}
