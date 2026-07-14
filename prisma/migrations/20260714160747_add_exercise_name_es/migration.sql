-- Spanish translation of the exercise catalog's name, populated for the
-- ~1,324 global (userId: null) seeded rows; nullable and left unset for
-- user-created custom exercises since it's not part of create/update DTOs.
ALTER TABLE "exercises" ADD COLUMN "name_es" TEXT;
