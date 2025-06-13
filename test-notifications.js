const { DatabaseStorage } = require('./server/db-storage.ts');

async function testNotifications() {
  try {
    const storage = new DatabaseStorage();
    
    // Verificar que los métodos existen
    console.log('Métodos disponibles:');
    console.log('- createNotification:', typeof storage.createNotification);
    console.log('- getNotifications:', typeof storage.getNotifications);
    console.log('- markNotificationAsRead:', typeof storage.markNotificationAsRead);
    console.log('- getUnreadNotificationsCount:', typeof storage.getUnreadNotificationsCount);
    
    // Intentar crear una notificación de prueba
    if (typeof storage.createNotification === 'function') {
      const testNotification = {
        userId: 3, // Usuario de prueba
        type: 'test',
        title: 'Notificación de prueba',
        message: 'Esta es una prueba del sistema de notificaciones',
        relatedId: null,
        metaData: null,
        read: false
      };
      
      const created = await storage.createNotification(testNotification);
      console.log('Notificación creada:', created);
      
      // Obtener notificaciones
      const notifications = await storage.getNotifications(3);
      console.log('Notificaciones obtenidas:', notifications.length);
    } else {
      console.log('ERROR: createNotification no es una función');
    }
    
  } catch (error) {
    console.error('Error en prueba:', error);
  }
}

testNotifications();