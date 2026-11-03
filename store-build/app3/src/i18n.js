// Runtime translator for the React app. English text is the key; unknown text stays English.
// Languages: en es ar hi vi yue zh. Arabic flips the page to right-to-left.
// COVERAGE IS PARTIAL (core screens). Native-speaker review needed before launch.
export const LANGS = [["en", "English"], ["es", "Español"], ["ar", "العربية"], ["hi", "हिन्दी"], ["vi", "Tiếng Việt"], ["yue", "廣東話"], ["zh", "中文"]];
const ORDER = ["es", "ar", "hi", "vi", "yue", "zh"];
const R = [
["Discover","Descubrir","استكشف","खोजें","Khám phá","發現","发现"],
["Matches","Coincidencias","التطابقات","मैच","Kết nối","配對","匹配"],
["Messages","Mensajes","الرسائل","संदेश","Tin nhắn","訊息","消息"],
["Profile","Perfil","الملف الشخصي","प्रोफ़ाइल","Hồ sơ","個人檔案","个人资料"],
["Swipe","Deslizar","اسحب","स्वाइप","Vuốt","滑動","滑动"],
["List","Lista","قائمة","सूची","Danh sách","清單","列表"],
["Best matches","Mejores coincidencias","أفضل التطابقات","सबसे अच्छे मैच","Phù hợp nhất","最佳配對","最佳匹配"],
["Available this week","Disponibles esta semana","متاح هذا الأسبوع","इस हफ़्ते उपलब्ध","Rảnh tuần này","本週有空","本周有空"],
["Checked","Verificados","تم التحقق","जाँचे गए","Đã kiểm tra","已查核","已核查"],
["Recently active","Activos recientemente","نشط مؤخرًا","हाल ही में सक्रिय","Mới hoạt động","最近活躍","最近活跃"],
["Saved","Guardados","المحفوظة","सहेजे गए","Đã lưu","已儲存","已保存"],
["Message","Mensaje","رسالة","संदेश","Nhắn tin","傳訊息","发消息"],
["Book","Reservar","احجز","बुक करें","Đặt lịch","預約","预约"],
["Save","Guardar","حفظ","सहेजें","Lưu","儲存","保存"],
["Send resume","Enviar currículum","أرسل سيرتي الذاتية","रिज़्यूमे भेजें","Gửi hồ sơ","傳送履歷","发送简历"],
["Find care. Share the day.","Encuentra cuidado. Comparte el día.","اعثر على رعاية. شارك اليوم.","देखभाल खोजें। दिन साझा करें।","Tìm người chăm sóc. Chia sẻ ngày.","搵人照顧。分享每一日。","找到照护。分享每一天。"],
["I need care","Necesito cuidado","أحتاج رعاية","मुझे देखभाल चाहिए","Tôi cần người chăm sóc","我需要照顧","我需要照护"],
["I give care","Doy cuidado","أقدّم الرعاية","मैं देखभाल करता/करती हूँ","Tôi chăm sóc trẻ","我提供照顧","我提供照护"],
["Find a babysitter, nanny or au pair","Encuentra niñera, nanny o au pair","اعثر على جليسة أطفال أو مربية أو أو بير","बेबीसिटर, नैनी या औ पेयर खोजें","Tìm người trông trẻ, bảo mẫu hoặc au pair","搵保姆、褓姆或換工","找保姆、育儿嫂或互惠生"],
["Find families. Carers always use it free.","Encuentra familias. Para cuidadores siempre es gratis.","اعثر على عائلات. الاستخدام مجاني دائمًا لمقدمي الرعاية.","परिवार खोजें। देखभालकर्ताओं के लिए हमेशा मुफ़्त।","Tìm gia đình. Người chăm sóc luôn dùng miễn phí.","搵家庭。照顧者永遠免費。","找家庭。照护者永远免费。"],
["Continue","Continuar","متابعة","जारी रखें","Tiếp tục","繼續","继续"],
["Finish","Terminar","إنهاء","पूरा करें","Hoàn tất","完成","完成"],
["Next","Siguiente","التالي","अगला","Tiếp","下一步","下一步"],
["Skip","Omitir","تخطّي","छोड़ें","Bỏ qua","略過","跳过"],
["Let's go","Vamos","هيا بنا","चलिए","Bắt đầu","出發","开始吧"],
["Send","Enviar","إرسال","भेजें","Gửi","傳送","发送"],
["Send request","Enviar solicitud","إرسال الطلب","अनुरोध भेजें","Gửi yêu cầu","傳送請求","发送请求"],
["Got it","Entendido","فهمت","समझ गया","Đã hiểu","明白","知道了"],
["Done","Listo","تم","हो गया","Xong","完成","完成"],
["How far?","¿Hasta qué distancia?","ما المسافة؟","कितनी दूर?","Bao xa?","幾遠？","多远？"],
["What matters to you?","¿Qué es importante para ti?","ما المهم بالنسبة لك؟","आपके लिए क्या मायने रखता है?","Điều gì quan trọng với bạn?","你最睇重乜嘢？","什么对你最重要？"],
["Show my matches","Ver mis coincidencias","اعرض تطابقاتي","मेरे मैच दिखाएँ","Xem kết quả","睇我嘅配對","查看我的匹配"],
["Widen search","Ampliar búsqueda","وسّع البحث","खोज बढ़ाएँ","Mở rộng tìm kiếm","擴大搜尋","扩大搜索"],
["It's a match!","¡Es una coincidencia!","إنه تطابق!","यह मैच है!","Đã kết nối!","配對成功！","匹配成功！"],
["Keep swiping","Seguir deslizando","واصل السحب","स्वाइप करते रहें","Tiếp tục vuốt","繼續滑","继续滑动"],
["You're connected","Están conectados","أنتم متصلون","आप जुड़ गए हैं","Bạn đã kết nối","已經連繫上","已建立联系"],
["Sign out","Cerrar sesión","تسجيل الخروج","साइन आउट","Đăng xuất","登出","退出登录"],
["Save changes","Guardar cambios","حفظ التغييرات","बदलाव सहेजें","Lưu thay đổi","儲存更改","保存更改"],
["Checks","Verificaciones","الفحوصات","जाँच","Kiểm tra","查核","核查"],
["About","Acerca de","نبذة","परिचय","Giới thiệu","簡介","简介"],
["References and reviews","Referencias y reseñas","المراجع والتقييمات","संदर्भ और समीक्षाएँ","Tham chiếu và đánh giá","推薦同評價","推荐与评价"],
["Turn the bunny down","Bajar al conejito","خفّف حركة الأرنب","खरगोश को शांत करें","Giảm chuyển động của thỏ","收細隻兔仔嘅動作","降低兔子的动作"],
["Au pair world","Mundo au pair","عالم الأو بير","औ पेयर दुनिया","Thế giới au pair","換工世界","互惠生世界"],
["Open the care-day app","Abrir la app del día a día","افتح تطبيق يوم الرعاية","देखभाल-दिन ऐप खोलें","Mở ứng dụng ngày chăm sóc","打開日常照顧App","打开日常照护应用"],
["Book my usual","Reservar a mi cuidador habitual","احجز مقدّمي المعتاد","मेरे नियमित को बुक करें","Đặt người quen","預約我慣用嘅","预约我常用的"],
["Say yes","Decir sí","قل نعم","हाँ कहें","Đồng ý","話好","说好"],
["Likes you","Les gustas","يعجبون بك","आपको पसंद करते हैं","Thích bạn","鍾意你","喜欢你"],
["Connected","Conectados","متصلون","जुड़े हुए","Đã kết nối","已連繫","已联系"],
["Waiting","En espera","بالانتظار","प्रतीक्षा में","Đang chờ","等緊","等待中"],
["No matches yet","Aún no hay coincidencias","لا تطابقات بعد","अभी कोई मैच नहीं","Chưa có kết nối","暫時未有配對","暂时没有匹配"],
["No chats yet","Aún no hay chats","لا محادثات بعد","अभी कोई चैट नहीं","Chưa có cuộc trò chuyện","暫時未有對話","暂时没有聊天"],
["Chats","Chats","المحادثات","चैट","Trò chuyện","對話","聊天"],
["Calendar","Calendario","التقويم","कैलेंडर","Lịch","日曆","日历"],
["Care","Cuidado","الرعاية","देखभाल","Chăm sóc","照顧","照护"],
["Activities","Actividades","الأنشطة","गतिविधियाँ","Hoạt động","活動","活动"],
["Add to calendar","Añadir al calendario","أضف إلى التقويم","कैलेंडर में जोड़ें","Thêm vào lịch","加入日曆","添加到日历"],
["Close","Cerrar","إغلاق","बंद करें","Đóng","關閉","关闭"],
["Today","Hoy","اليوم","आज","Hôm nay","今日","今天"],
["Children","Niños","الأطفال","बच्चे","Trẻ em","小朋友","孩子"],
["Daily report","Informe diario","التقرير اليومي","दैनिक रिपोर्ट","Báo cáo hằng ngày","每日報告","每日报告"],
["Log a meal","Registrar una comida","سجّل وجبة","भोजन दर्ज करें","Ghi bữa ăn","記錄一餐","记录一餐"],
["Why it matches you","Por qué coincide contigo","لماذا يناسبك","यह आपसे क्यों मेल खाता है","Vì sao phù hợp với bạn","點解啱你","为什么适合你"],
["Great match","Excelente coincidencia","تطابق ممتاز","बेहतरीन मैच","Rất phù hợp","非常配","非常匹配"],
["Good match","Buena coincidencia","تطابق جيد","अच्छा मैच","Phù hợp tốt","幾配","比较匹配"],
["Possible match","Posible coincidencia","تطابق محتمل","संभावित मैच","Có thể phù hợp","可能配","可能匹配"],
["Low match","Coincidencia baja","تطابق منخفض","कम मैच","Ít phù hợp","唔太配","匹配度低"],
["Countries","Países","الدول","देश","Quốc gia","國家","国家"],
["Host profile","Perfil de familia anfitriona","ملف الأسرة المضيفة","होस्ट प्रोफ़ाइल","Hồ sơ gia đình","寄宿家庭檔案","寄宿家庭资料"],
["Au pair profile","Perfil de au pair","ملف الأو بير","औ पेयर प्रोफ़ाइल","Hồ sơ au pair","換工檔案","互惠生资料"],
["Childcare duties","Tareas de cuidado infantil","مهام رعاية الأطفال","बाल देखभाल कार्य","Việc chăm trẻ","照顧小朋友嘅工作","照看孩子的工作"],
["Repeat weekly","Repetir cada semana","كرّر أسبوعيًا","साप्ताहिक दोहराएँ","Lặp lại hằng tuần","每週重複","每周重复"],
["Just once","Solo una vez","مرة واحدة فقط","सिर्फ़ एक बार","Chỉ một lần","只係一次","仅一次"],
["Day","Día","اليوم","दिन","Ngày","日子","日期"],
["From","Desde","من","से","Từ","由","从"],
["To","Hasta","إلى","तक","Đến","至","至"],
["Language","Idioma","اللغة","भाषा","Ngôn ngữ","語言","语言"],
["Say hello...","Di hola...","قل مرحبًا...","नमस्ते कहें...","Gửi lời chào...","打個招呼...","打个招呼..."],
["Your password","Tu contraseña","كلمة المرور","आपका पासवर्ड","Mật khẩu của bạn","你嘅密碼","你的密码"],
["Priorities","Prioridades","الأولويات","प्राथमिकताएँ","Ưu tiên","優先次序","优先事项"],
["Distance","Distancia","المسافة","दूरी","Khoảng cách","距離","距离"],
["Notifications","Notificaciones","الإشعارات","सूचनाएं","Thông báo","通知","通知"],
["Nothing new.","Nada nuevo.","لا جديد.","कुछ नया नहीं।","Không có gì mới.","沒有新消息。","没有新消息。"],
["How it adds up","Como se calcula","كيف تُحسب","यह कैसे जुड़ता है","Cách tính","點樣計算","如何计算"],
["Not stated","No indicado","غير مذكور","नहीं बताया","Chưa nêu","未有說明","未说明"],
["Ask for an update","Pedir una actualizacion","اطلب تحديثا","अपडेट माँगें","Hỏi cập nhật","要求更新","请求更新"],
["Send update","Enviar actualizacion","أرسل تحديثا","अपडेट भेजें","Gửi cập nhật","發送更新","发送更新"],
["Update asked by a parent","Un padre pidio una actualizacion","طلب أحد الوالدين تحديثا","अभिभावक ने अपडेट माँगा","Phụ huynh hỏi cập nhật","家長要求更新","家长请求更新"],
["You are offline. You can still read. Messages will send when you are back.","Sin conexion. Puedes leer. Los mensajes se enviaran al volver.","أنت غير متصل. يمكنك القراءة. سترسل الرسائل عند عودتك.","आप ऑफ़लाइन हैं। पढ़ सकते हैं। वापस आने पर संदेश भेजे जाएंगे।","Bạn đang ngoại tuyến. Tin nhắn sẽ gửi khi có mạng.","你離線中。訊息會喺返嚟時發送。","你已离线。恢复后将发送消息。"],
];
const DICT = {}; for (const r of R) { DICT[r[0]] = {}; ORDER.forEach((l, i) => (DICT[r[0]][l] = r[i + 1])); }
let lang = "en";
export const getLang = () => { try { return localStorage.getItem("caresits-lang-x") || "en"; } catch { return "en"; } };
const split = (s) => { const m = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u.exec(s); return m ? [m[1], m[2], m[3]] : ["", s, ""]; };
export const tr = (s) => { if (lang === "en" || !s) return s; const [a, c, z] = split(s); const e = DICT[c.trim()]; return e && e[lang] ? a + e[lang] + z : s; };
const orig = new WeakMap();
function walk(n) {
  if (n.nodeType === 3) { const o = orig.get(n); const base = o && n.nodeValue === o.out ? o.src : n.nodeValue; const out = lang === "en" ? base : tr(base); if (out !== n.nodeValue) { orig.set(n, { src: base, out }); n.nodeValue = out; } else if (!o) orig.set(n, { src: base, out: base }); return; }
  if (n.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(n.tagName)) return;
  if (n.placeholder !== undefined && n.getAttribute) { const p = n.getAttribute("placeholder"); if (p) { if (!n.__ph) n.__ph = p; const out = lang === "en" ? n.__ph : tr(n.__ph); if (out !== p) n.setAttribute("placeholder", out); } }
  n.childNodes.forEach(walk);
}
export function setLang(l) { lang = l; try { localStorage.setItem("caresits-lang-x", l); } catch {} const d = document.documentElement; d.lang = l === "yue" ? "zh-HK" : l; d.dir = l === "ar" ? "rtl" : "ltr"; walk(document.body); }
export function initI18n() { lang = getLang(); setLang(lang); new MutationObserver((ms) => { for (const m of ms) { if (m.type === "characterData") walk(m.target); m.addedNodes.forEach(walk); } }).observe(document.body, { childList: true, subtree: true, characterData: true }); }
export const _DICT = DICT;
