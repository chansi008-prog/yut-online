// Firebase 콘솔의 "웹 앱 설정" 값. 이 값은 앱에 원래 공개로 들어가는 값이고,
// 실제 보호는 Firebase 보안 규칙(database.rules.json)이 한다.
// 이 객체를 비우면 테스트 모드(같은 브라우저의 탭끼리만 연결)로 돌아간다.
export const firebaseConfig = {
  apiKey: "AIzaSyDxtx1nmtWoAuuikVWq_IekmENqkzy2ptE",
  authDomain: "yutpan-online.firebaseapp.com",
  databaseURL: "https://yutpan-online-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "yutpan-online",
  storageBucket: "yutpan-online.firebasestorage.app",
  messagingSenderId: "96906508019",
  appId: "1:96906508019:web:768789f5ee4f95c02ae986",
};
