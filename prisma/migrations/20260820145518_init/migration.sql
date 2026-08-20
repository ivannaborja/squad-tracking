-- CreateTable
CREATE TABLE "squad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "squad_snapshot" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "semana_inicio" DATE NOT NULL,
    "fecha_referencia" DATE NOT NULL,
    "trimestre" TEXT NOT NULL,
    "delivery_real_pct" DOUBLE PRECISION NOT NULL,
    "discovery_real_pct" DOUBLE PRECISION NOT NULL,
    "delivery_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "discovery_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "esperado_pct" DOUBLE PRECISION NOT NULL,
    "delivery_delta_pct" DOUBLE PRECISION NOT NULL,
    "discovery_delta_pct" DOUBLE PRECISION NOT NULL,
    "semaforo" TEXT NOT NULL,
    "frase_pronostico" TEXT,
    "editado_por" TEXT NOT NULL,

    CONSTRAINT "squad_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "codigo_externo" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "pct_avance" DOUBLE PRECISION NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "semana_inicio" DATE NOT NULL,

    CONSTRAINT "initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria_impacto" TEXT NOT NULL,
    "severidad" TEXT NOT NULL,
    "dueno" TEXT NOT NULL,
    "accion_proxima" TEXT NOT NULL,
    "checkpoint" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "semana_inicio" DATE NOT NULL,
    "semana_fin" DATE NOT NULL,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_squad" (
    "risk_id" INTEGER NOT NULL,
    "squad_id" INTEGER NOT NULL,

    CONSTRAINT "risk_squad_pkey" PRIMARY KEY ("risk_id","squad_id")
);

-- CreateTable
CREATE TABLE "need" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "dueno" TEXT NOT NULL,
    "semana_inicio" DATE NOT NULL,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "need_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upcoming_delivery" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_estimada" DATE NOT NULL,
    "semana_inicio" DATE NOT NULL,

    CONSTRAINT "upcoming_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "semana_inicio" DATE NOT NULL,

    CONSTRAINT "achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unplanned_intake" (
    "id" SERIAL NOT NULL,
    "squad_id" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "semana_inicio" DATE NOT NULL,

    CONSTRAINT "unplanned_intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_staging" (
    "token" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_staging_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "action_plan" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "dueno" TEXT NOT NULL,
    "plazo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "semana_inicio" DATE NOT NULL,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "action_plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "squad_snapshot_squad_id_semana_inicio_key" ON "squad_snapshot"("squad_id", "semana_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "initiative_squad_id_codigo_externo_key" ON "initiative"("squad_id", "codigo_externo");

-- AddForeignKey
ALTER TABLE "squad_snapshot" ADD CONSTRAINT "squad_snapshot_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_squad" ADD CONSTRAINT "risk_squad_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_squad" ADD CONSTRAINT "risk_squad_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "need" ADD CONSTRAINT "need_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upcoming_delivery" ADD CONSTRAINT "upcoming_delivery_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement" ADD CONSTRAINT "achievement_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unplanned_intake" ADD CONSTRAINT "unplanned_intake_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
