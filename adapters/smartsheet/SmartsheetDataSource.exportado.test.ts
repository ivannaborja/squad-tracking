import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { SmartsheetDataSource, type SquadRef } from './SmartsheetDataSource';

// El guard de "archivo más viejo" del import se apoya en workbook.created (que
// Smartsheet setea al exportar). Acá se verifica que el adaptador lo lee y lo
// expone tal cual por exportadoEn().
const REFS: SquadRef[] = [{ id: 1, nombre: 'Alfa' }];

async function bufferConCreated(created: Date | undefined): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  if (created) wb.created = created;
  const ws = wb.addWorksheet('Etica - 2026');
  // Header + un squad mínimo: alcanza para construir la fuente sin errores.
  ws.getRow(1).getCell(5).value = 'Nombre';
  ws.getRow(1).getCell(22).value = 'Identificador de la fila';
  ws.getRow(2).getCell(5).value = 'Alfa';
  ws.getRow(2).getCell(13).value = 0.5;
  ws.getRow(2).getCell(22).value = 'AL';
  return (await wb.xlsx.writeBuffer()) as unknown as Uint8Array;
}

describe('SmartsheetDataSource — exportadoEn (fecha de exportación del .xlsx)', () => {
  it('devuelve la fecha de workbook.created', async () => {
    const created = new Date('2026-09-11T10:00:00.000Z');
    const source = await SmartsheetDataSource.fromArrayBuffer(await bufferConCreated(created), REFS);
    expect(source.exportadoEn()?.toISOString()).toBe(created.toISOString());
  });
});
