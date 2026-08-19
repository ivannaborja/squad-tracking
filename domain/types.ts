export interface Risk {
  categoriaImpacto: string;
  resuelto: boolean;
  semanaInicio: string; // formato YYYY-MM-DD
  semanaFin: string;
}

export type Semaforo = 'rojo' | 'amarillo' | 'verde';