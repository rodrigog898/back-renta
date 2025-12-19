import cron from 'node-cron';
import { caducarCotizacionesVencidas } 
  from '../services/cotizacion/caducarCotizaciones.service';


// programado para revisar cada una hora las cotizaciones vencidas y caducarlas
export function startCaducarCotizacionesCron() {
  const cronExpression = process.env.CRON_CADUCIDAD_TIEMPO;

if (!cronExpression) {
  throw new Error('CRON_CADUCIDAD_COTIZACIONES no está definido en .env');
}
  
  cron.schedule(cronExpression, async () => { 
    console.log('Cron: revisando cotizaciones vencidas...');
    try {
      await caducarCotizacionesVencidas();
    } catch (error) {
      console.error('Error en cron de caducidad:', error);
    }
  });

  console.log(`Cron de caducidad iniciado con expresión: ${cronExpression}`);
}
