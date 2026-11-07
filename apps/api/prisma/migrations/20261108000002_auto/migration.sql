-- CreateTable
CREATE TABLE "classrooms" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "grade_label" TEXT,
    "join_code" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_games" (
    "id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "source_game_id" UUID,
    "title" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "access_level" "AccessLevel" NOT NULL,
    "content" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_students" (
    "id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '🙂',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_plays" (
    "id" UUID NOT NULL,
    "class_game_id" UUID NOT NULL,
    "student_id" UUID,
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "stars" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_plays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_join_code_key" ON "classrooms"("join_code");

-- CreateIndex
CREATE INDEX "classrooms_owner_id_is_archived_idx" ON "classrooms"("owner_id", "is_archived");

-- CreateIndex
CREATE INDEX "class_games_classroom_id_sort_order_idx" ON "class_games"("classroom_id", "sort_order");

-- CreateIndex
CREATE INDEX "class_students_classroom_id_idx" ON "class_students"("classroom_id");

-- CreateIndex
CREATE INDEX "class_plays_class_game_id_created_at_idx" ON "class_plays"("class_game_id", "created_at");

-- CreateIndex
CREATE INDEX "class_plays_student_id_created_at_idx" ON "class_plays"("student_id", "created_at");

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_games" ADD CONSTRAINT "class_games_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_games" ADD CONSTRAINT "class_games_source_game_id_fkey" FOREIGN KEY ("source_game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_plays" ADD CONSTRAINT "class_plays_class_game_id_fkey" FOREIGN KEY ("class_game_id") REFERENCES "class_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_plays" ADD CONSTRAINT "class_plays_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "class_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

