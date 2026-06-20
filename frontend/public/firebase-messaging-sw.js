// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase app in service worker
const firebaseConfig = {
  apiKey: "mock-api-key",
  authDomain: "unitax-fcm.firebaseapp.com",
  projectId: "unitax-fcm",
  storageBucket: "unitax-fcm.appspot.com",
  messagingSenderId: "109876543210",
  appId: "1:109876543210:web:mockappid"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title || 'UniTax';
  const notificationOptions = {
    body: payload.notification.body || 'Нове повідомлення',
    icon: '/icon-192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
