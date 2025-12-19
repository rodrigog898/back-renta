import Cotizacion from '../../models/Cbitacora';

const DIAS_VIGENCIA = parseInt(process.env.EXPIRACION_DE_COTIZACION || '15');

// Utilidad local: resta días a una fecha
function restarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() - dias);
  return copia;
}

// CADUCAR COTIZACIONES VENCIDAS
export async function caducarCotizacionesVencidas() {
  try {
    const fechaLimite = restarDias(new Date(), DIAS_VIGENCIA);

    const resultado = await Cotizacion.updateMany(
      {
        estado: { $nin: ['CADUCADA'] },
        $expr: {
          $lte: [
            {
              $dateFromString: {
                dateString: '$fecha_cotizacion',
                format: '%d-%m-%Y %H:%M:%S',
                onError: null,
                onNull: null
              }
            },
            fechaLimite
          ]
        }
      },
      {
        $set: {
          estado: 'CADUCADA'
        }
      }
    );

    if (resultado.modifiedCount > 0) {
      console.log(
        `${resultado.modifiedCount} cotizaciones caducadas automáticamente (vigencia: ${DIAS_VIGENCIA} días)`
      );
    } else {
      console.log('No hay cotizaciones para caducar');
    }

    return resultado;
  } catch (error) {
    console.error('❌ Error al caducar cotizaciones:', error);
    throw error;
  }
}


// busca si existe una cotización vigente para la patente dada
export async function existeCotizacionVigente(patente: string): Promise<boolean> {
  const cotizacionVigente = await Cotizacion.findOne({
    'vehiculo.patente': patente.toUpperCase(),
    estado: { $nin: ['CADUCADA'] } // Estados que bloquea
  });

  return cotizacionVigente !== null;
}

// Obtener detalles de cotización vigente (para mostrar info al usuario)
export async function obtenerCotizacionVigente(patente: string) {
  return await Cotizacion.findOne({
    'vehiculo.patente': patente.toUpperCase(),
    estado: { $nin: ['CADUCADA'] }
  }).select('n_cotizacion fecha_cotizacion estado id_corredor');
}