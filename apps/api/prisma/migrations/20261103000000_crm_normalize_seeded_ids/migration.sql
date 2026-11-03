-- Normalize backfilled CRM identifiers to cuid-style ids (c + 24 lowercase
-- alphanumerics) so they satisfy ParseCuidPipe (^c[0-9a-z]{24}$) on :id routes.
-- Backfill used deterministic prefixes (cmp_/pipe_/stage_ + md5); the new ids are
-- derived deterministically from the old ones. All FKs referencing these tables
-- are declared ON UPDATE CASCADE, so updating parent PKs updates children too.
-- DealStageHistory stage columns carry no FK, so they are updated explicitly.

BEGIN;

UPDATE "Company" c
SET id = 'c' || substr(md5(c.id || ':normalize'), 1, 24)
WHERE c.id ~ '^cmp_[0-9a-f]{24}$';

UPDATE "Pipeline" p
SET id = 'c' || substr(md5(p.id || ':normalize'), 1, 24)
WHERE p.id ~ '^pipe_[0-9a-f]{24}$';

UPDATE "PipelineStage" s
SET id = 'c' || substr(md5(s.id || ':normalize'), 1, 24)
WHERE s.id ~ '^stage_[0-9a-f]{24}$';

UPDATE "DealStageHistory" h
SET "fromStageId" = 'c' || substr(md5(h."fromStageId" || ':normalize'), 1, 24)
WHERE h."fromStageId" ~ '^stage_[0-9a-f]{24}$';

UPDATE "DealStageHistory" h
SET "toStageId" = 'c' || substr(md5(h."toStageId" || ':normalize'), 1, 24)
WHERE h."toStageId" ~ '^stage_[0-9a-f]{24}$';

COMMIT;
