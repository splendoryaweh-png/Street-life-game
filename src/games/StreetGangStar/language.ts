/**
 * Street Gang Star - Multi-Language Localization System
 * Supported Languages:
 *   - 'en': English (Default)
 *   - 'fr': French
 *   - 'ar': Arabic (RTL support)
 *   - 'pidgin' / 'pcm': Nigerian Pidgin English
 *   - 'es': Spanish
 *   - 'pt': Portuguese
 */

export type GangStarLanguage = 'en' | 'fr' | 'ar' | 'pidgin' | 'pcm' | 'es' | 'pt' | 'zh' | 'ko' | 'he';

export type GangStarTextKey =
  | 'game_title'
  | 'intro_boss_name'
  | 'intro_call_1'
  | 'intro_call_2'
  | 'intro_call_3'
  | 'mission_save'
  | 'robber_alert'
  | 'gun_shop'
  | 'betray_warning'
  | 'team_join'
  | 'team_blue'
  | 'team_red'
  | 'team_blue_desc'
  | 'team_red_desc'
  | 'switch_team'
  | 'car_enter'
  | 'car_exit'
  | 'car_hijacked'
  | 'cover_active'
  | 'cover_inactive'
  | 'health'
  | 'ammo'
  | 'coins'
  | 'leaderboard'
  | 'civilians_saved'
  | 'gangsters_eliminated'
  | 'weapon_pistol'
  | 'weapon_shotgun'
  | 'weapon_ak'
  | 'weapon_sniper'
  | 'insufficient_coins'
  | 'purchased'
  | 'reload_alert'
  | 'start_game'
  | 'next'
  | 'close'
  | 'back'
  | 'exit_game'
  | 'customize_avatar'
  | 'choose_color'
  | 'choose_face'
  | 'room_code'
  | 'create_room'
  | 'join_room'
  | 'invite_code'
  | 'random_city'
  | 'players_online'
  | 'host_badge'
  | 'civilian_saved_alert'
  | 'player_down'
  | 'respawning'
  | 'controls_guide'
  | 'multiplayer_title'
  | 'single_player_title';

const TRANSLATIONS: Record<string, Record<GangStarTextKey, string>> = {
  en: {
    game_title: 'Street Gang Star',
    intro_boss_name: 'Street Boss',
    intro_call_1: 'Yo, gangsters are robbing the street! Go stop them!',
    intro_call_2: 'They got high-tech laser rifles, motorcycles, and armored syndicate buses. The civilians are trapped!',
    intro_call_3: 'Gear up, get to cover, and take out the syndicate leaders. Clean up our street now!',
    mission_save: 'Mission: Save civilians and eliminate all gangster invaders!',
    robber_alert: 'WARNING: Gangster raid detected nearby!',
    gun_shop: 'Syndicate Gun Shop',
    betray_warning: 'TREASON! You shot your own teammate! Betrayal in the streets!',
    team_join: 'Choose Your Street Faction',
    team_blue: 'BLUE SYNDICATE (DEFEND STREET)',
    team_red: 'RED CORSAIRS (FREE FOR ALL)',
    team_blue_desc: 'Protect civilians and hunt down the robbers together.',
    team_red_desc: 'Every hustler for himself. No rules, absolute chaos.',
    switch_team: 'Switch Faction [T]',
    car_enter: 'Press E to Drive Vehicle',
    car_exit: 'Press E to Exit Vehicle',
    car_hijacked: 'Vehicle hijacked from syndicate driver!',
    cover_active: 'IN COVER (-80% Laser Damage)',
    cover_inactive: 'Cover Available [Q]',
    health: 'HEALTH',
    ammo: 'AMMO',
    coins: 'STREET CASH',
    leaderboard: 'City Syndicate Leaderboard',
    civilians_saved: 'Civilians Saved',
    gangsters_eliminated: 'Gangsters Neutralized',
    weapon_pistol: 'Standard Laser Pistol (10 DMG)',
    weapon_shotgun: 'Scatter Laser Shotgun (25 DMG)',
    weapon_ak: 'Rapid Auto-Laser AK-47 (15 DMG)',
    weapon_sniper: 'Heavy Pulse Sniper (40 DMG)',
    insufficient_coins: 'Not enough Street Cash! Take out gangsters to earn +5 coins.',
    purchased: 'Weapon Acquired & Armed!',
    reload_alert: 'RELOADING PULSE BATTERY...',
    start_game: 'START MISSION',
    next: 'NEXT',
    close: 'CLOSE',
    back: 'BACK',
    exit_game: 'EXIT TO STREET',
    customize_avatar: 'Customize Street Hustler',
    choose_color: 'Tactical Gear Color',
    choose_face: 'Combat Mask / Face',
    room_code: 'Room Code',
    create_room: 'CREATE NEW CITY LOBBY',
    join_room: 'JOIN VIA INVITE CODE',
    invite_code: 'ENTER ROOM CODE (e.g. STREET101)',
    random_city: 'QUICK JOIN RANDOM CITY',
    players_online: 'Hustlers In District',
    host_badge: 'DISTRICT LEADER (HOST)',
    civilian_saved_alert: 'Civilian rescued! +10 Street Honor',
    player_down: 'CRITICAL INJURY! Medic reviving...',
    respawning: 'Respawning in safe house...',
    controls_guide: 'WASD: Move | MOUSE: Aim | CLICK: Shoot | E: Vehicle | Q: Cover | R: Reload | B: Shop',
    multiplayer_title: 'Multiplayer District Warfare',
    single_player_title: 'Single Player Campaign',
  },

  fr: {
    game_title: 'Street Gang Star',
    intro_boss_name: 'Boss de Rue',
    intro_call_1: 'Yo, des gangsters braquent la rue ! Va les arrêter !',
    intro_call_2: 'Ils ont des fusils laser haute technologie, des motos et des bus blindés. Les civils sont piégés !',
    intro_call_3: 'Équipe-toi, mets-toi à couvert et neutralise les chefs de gang. Nettoie notre quartier tout de suite !',
    mission_save: 'Mission : Sauve les civils et élimine tous les gangsters !',
    robber_alert: 'ATTENTION : Attaque de gangsters signalée à proximité !',
    gun_shop: 'Armurerie Clandestine',
    betray_warning: 'TRAHISON ! Tu as tiré sur ton propre coéquipier ! Aucun respect dans la rue !',
    team_join: 'Choisis Ta Faction',
    team_blue: 'SYNDICAT BLEU (DÉFENSEURS)',
    team_red: 'CORSAIRES ROUGES (CHACUN POUR SOI)',
    team_blue_desc: 'Protège les citoyens et repousse les braqueurs.',
    team_red_desc: 'Aucune loi. Anarchie totale dans toute la ville.',
    switch_team: 'Changer de Camp [T]',
    car_enter: 'Appuie sur E pour Conduire',
    car_exit: 'Appuie sur E pour Sortir',
    car_hijacked: 'Véhicule braqué avec succès !',
    cover_active: 'À COUVERT (-80% Dégâts Laser)',
    cover_inactive: 'Couverture Prête [Q]',
    health: 'SANTÉ',
    ammo: 'MUNITIONS',
    coins: 'ARGENT DE RUE',
    leaderboard: 'Classement du Syndicat',
    civilians_saved: 'Civils Sauvés',
    gangsters_eliminated: 'Gangsters Neutralisés',
    weapon_pistol: 'Pistolet Laser Standard (10 DMG)',
    weapon_shotgun: 'Fusil à Dispersion Laser (25 DMG)',
    weapon_ak: 'AK-47 Laser Rafale (15 DMG)',
    weapon_sniper: 'Sniper Pulse Lourd (40 DMG)',
    insufficient_coins: 'Pas assez de cash ! Élimine des gangsters (+5 pièces).',
    purchased: 'Arme Achetée et Équipée !',
    reload_alert: 'RECHARGEMENT BATTERIE EN COURS...',
    start_game: 'LANCER LA MISSION',
    next: 'SUIVANT',
    close: 'FERMER',
    back: 'RETOUR',
    exit_game: 'QUITTER LA RUE',
    customize_avatar: 'Personnaliser Ton Hustler',
    choose_color: 'Couleur de Tenue Tactique',
    choose_face: 'Masque / Visage de Combat',
    room_code: 'Code de Salle',
    create_room: 'CRÉER UN DISTRICT',
    join_room: 'REJOINDRE AVEC CODE',
    invite_code: 'ENTRER LE CODE (ex. STREET101)',
    random_city: 'REJOINDRE VILLE ALÉATOIRE',
    players_online: 'Joueurs Connectés',
    host_badge: 'CHEF DE DISTRICT (HÔTE)',
    civilian_saved_alert: 'Civil sauvé ! +10 Honneur',
    player_down: 'BLESSURE CRITIQUE ! Réanimation en cours...',
    respawning: 'Réapparition au refuge...',
    controls_guide: 'ZQSD/WASD: Déplacer | SOURIS: Viser | CLIC: Tirer | E: Véhicule | Q: Couvert | R: Recharger | B: Boutique',
    multiplayer_title: 'Guerre Urbaine Multijoueur',
    single_player_title: 'Campagne Solo',
  },

  pidgin: {
    game_title: 'Street Gang Star',
    intro_boss_name: 'Street Boss',
    intro_call_1: 'Omo! Dem gangsters dey rob street for here o! Go stop dem sharp sharp!',
    intro_call_2: 'Dem carry laser guns, motors and big buses dey terrorize the whole area. Civilians dey cry!',
    intro_call_3: 'Load your gun, take cover behind motor, burst dem gangsters head now now!',
    mission_save: 'Mission: Save our people and chase all robbers commot street!',
    robber_alert: 'ALERT: Bad boys don enter this street with heavy weapons!',
    gun_shop: 'Street Gun Bunker',
    betray_warning: 'WAYO! You shoot your own guy! Street get mind o, no be so!',
    team_join: 'Pick Your Street Camp',
    team_blue: 'BLUE BOYS (DEFEND STREET)',
    team_red: 'RED KILLERS (FREE FOR ALL)',
    team_blue_desc: 'Stand firm, protect innocent civilians together.',
    team_red_desc: 'Wahala full ground! Shoot everybody wey cross your lane.',
    switch_team: 'Change Gang [T]',
    car_enter: 'Press E enter motor drive',
    car_exit: 'Press E commot motor',
    car_hijacked: 'You don collect motor from the bad boy driver!',
    cover_active: 'YOU DEY UNDER COVER (-80% Laser Waka)',
    cover_inactive: 'Take Cover [Q]',
    health: 'BLOOD / LIFE',
    ammo: 'BULLET',
    coins: 'STREET CASH',
    leaderboard: 'Oga of the Street Board',
    civilians_saved: 'People We Saved',
    gangsters_eliminated: 'Robbers Wey Fall',
    weapon_pistol: 'Standard Laser Gun (10 DMG)',
    weapon_shotgun: 'Scatter Laser Shocker (25 DMG)',
    weapon_ak: 'Rapid Laser AK-47 (15 DMG)',
    weapon_sniper: 'Heavy Sniper Flash (40 DMG)',
    insufficient_coins: 'Cash no reach! Drop gangsters make you chop +5 coins.',
    purchased: 'Gun don set inside your hand!',
    reload_alert: 'CHARGING LASER PACK...',
    start_game: 'ENTER STREET',
    next: 'NEXT',
    close: 'CLOSE',
    back: 'BACK',
    exit_game: 'RUN COMMOT',
    customize_avatar: 'Tune Your Street Guy',
    choose_color: 'Cloth Color',
    choose_face: 'Combat Mask / Face',
    room_code: 'Room Code',
    create_room: 'START NEW DISTRICT BATTLE',
    join_room: 'JOIN WITH CODE',
    invite_code: 'ENTER STREET CODE (e.g. STREET101)',
    random_city: 'ENTER ANY ACTIVE STREET',
    players_online: 'Hustlers On Street',
    host_badge: 'STREET CHAIRMAN (HOST)',
    civilian_saved_alert: 'You don save person! +10 Respect',
    player_down: 'DEM DON TOUCH YOU! Medic dey come...',
    respawning: 'Waking up for base...',
    controls_guide: 'WASD: Waka | MOUSE: Target | CLICK: Shoot | E: Enter Motor | Q: Hide | R: Reload | B: Market',
    multiplayer_title: 'Full Area Street War (Multiplayer)',
    single_player_title: 'Solo Street Mission',
  },

  ar: {
    game_title: 'ستريت غانغ ستار',
    intro_boss_name: 'زعيم الشارع',
    intro_call_1: 'يا رجل، العصابات تسرق الشارع! اذهب وأوقفهم فوراً!',
    intro_call_2: 'إنهم يمتلكون بنادق ليزر متطورة ودراجات نارية وحافلات مصفحة. المدنيون في خطر شديد!',
    intro_call_3: 'تسلح فوراً، احتمِ خلف المباني والمركبات واقضِ على قادة العصابة. طهر شارعنا الآن!',
    mission_save: 'المهمة: أنقذ المدنيين واقضِ على جميع المهاجمين!',
    robber_alert: 'تحذير: هجوم عصابات مسلح في المنطقة المجاورة!',
    gun_shop: 'متجر أسلحة الليزر',
    betray_warning: 'خيانة! لقد أطلقت النار على زميلك في الفريق! غدر في الشوارع!',
    team_join: 'اختر فصيلتك في الشارع',
    team_blue: 'الفريق الأزرق (حماة الشارع)',
    team_red: 'الفريق الأحمر (فوضى عارمة)',
    team_blue_desc: 'احمِ المدنيين وتعاون للقضاء على المعتدين.',
    team_red_desc: 'لا قواعد ولا قوانين. البقاء للأقوى فقط.',
    switch_team: 'تبديل الفريق [T]',
    car_enter: 'اضغط E لقيادة السيارة',
    car_exit: 'اضغط E للنزول من السيارة',
    car_hijacked: 'تم الاستيلاء على السيارة بنجاح!',
    cover_active: 'في وضع التغطية (-80% ضرر ليزر)',
    cover_inactive: 'الاحتماء متاح [Q]',
    health: 'الصحة',
    ammo: 'الذخيرة',
    coins: 'أموال الشارع',
    leaderboard: 'قائمة متصدري العصابات',
    civilians_saved: 'المدنيون الذين تم إنقاذهم',
    gangsters_eliminated: 'المجرمون الذين تمت تصفيتهم',
    weapon_pistol: 'مسدس ليزر قياسي (10 ضرر)',
    weapon_shotgun: 'شوت غان ليزر انتشار (25 ضرر)',
    weapon_ak: 'رشاش ليزر آلي AK-47 (15 ضرر)',
    weapon_sniper: 'قناصة ليزر ثقيلة (40 ضرر)',
    insufficient_coins: 'الرصيد لا يكفي! اقضِ على العصابات لكسب +5 نقود.',
    purchased: 'تم شراء وتجهيز السلاح!',
    reload_alert: 'جارٍ إعادة شحن طاقة الليزر...',
    start_game: 'بدء المهمة',
    next: 'التالي',
    close: 'إغلاق',
    back: 'رجوع',
    exit_game: 'الخروج للشارع',
    customize_avatar: 'تخصيص الشخصية',
    choose_color: 'لون الزي التكتيكي',
    choose_face: 'قناع / مظهر الوجه',
    room_code: 'رمز الغرفة',
    create_room: 'إنشاء مدينة جديدة',
    join_room: 'الانضمام برمز الدعوة',
    invite_code: 'أدخل رمز الغرفة (مثال: STREET101)',
    random_city: 'دخول سريع لمدينة عشوائية',
    players_online: 'المقاتلون المتصلون',
    host_badge: 'زعيم المنطقة (المضيف)',
    civilian_saved_alert: 'تم إنقاذ مدني! +10 شرف شارع',
    player_down: 'إصابة بالغة! المسعف في الطريق...',
    respawning: 'إعادة الظهور في المقر الآمن...',
    controls_guide: 'WASD: تحرك | الفأرة: تصويب | النقر: إطلاق | E: مركبة | Q: احتماء | R: تعبئة | B: متجر',
    multiplayer_title: 'حرب شوارع جماعية',
    single_player_title: 'الطور الفردي',
  },

  es: {
    game_title: 'Street Gang Star',
    intro_boss_name: 'Jefe del Barrio',
    intro_call_1: '¡Oye, los gángsters están atracando la calle! ¡Ve a detenerlos!',
    intro_call_2: 'Tienen rifles láser de alta tecnología, motocicletas y autobuses blindados. ¡Los civiles están atrapados!',
    intro_call_3: 'Ármate, cúbrete detrás de los edificios y acaba con los líderes. ¡Limpia nuestra calle ya!',
    mission_save: 'Misión: ¡Salva a los civiles y elimina a todos los invasores!',
    robber_alert: '¡ALERTA: Redada de gángsters detectada cerca!',
    gun_shop: 'Tienda de Armas Clandestina',
    betray_warning: '¡TRAICIÓN! ¡Le disparaste a tu compañero! ¡Guerra sucia en la calle!',
    team_join: 'Elige Tu Facción Callejera',
    team_blue: 'SINDICATO AZUL (DEFENSA)',
    team_red: 'CORSARIOS ROJOS (TODOS CONTRA TODOS)',
    team_blue_desc: 'Protege a los ciudadanos y derrota a los atacantes en equipo.',
    team_red_desc: 'Sin reglas ni alianzas. Caos total en cada esquina.',
    switch_team: 'Cambiar de Bando [T]',
    car_enter: 'Pulsa E para Conducir',
    car_exit: 'Pulsa E para Bajar del Coche',
    car_hijacked: '¡Vehículo confiscado al conductor del sindicato!',
    cover_active: 'A CUBIERTO (-80% Daño Láser)',
    cover_inactive: 'Cobertura Disponible [Q]',
    health: 'SALUD',
    ammo: 'MUNICIÓN',
    coins: 'DINERO CALLEJERO',
    leaderboard: 'Clasificación del Sindicato',
    civilians_saved: 'Civiles Rescatados',
    gangsters_eliminated: 'Gángsters Eliminados',
    weapon_pistol: 'Pistola Láser Estándar (10 DMG)',
    weapon_shotgun: 'Escopeta Láser de Dispersión (25 DMG)',
    weapon_ak: 'AK-47 Láser Ráfaga (15 DMG)',
    weapon_sniper: 'Francotirador de Pulso Pesado (40 DMG)',
    insufficient_coins: '¡Fondos insuficientes! Elimina gángsters para ganar +5 monedas.',
    purchased: '¡Arma Adquirida y Equipada!',
    reload_alert: 'RECARGANDO BATERÍA LÁSER...',
    start_game: 'INICIAR MISIÓN',
    next: 'SIGUIENTE',
    close: 'CERRAR',
    back: 'VOLVER',
    exit_game: 'SALIR AL BARRIO',
    customize_avatar: 'Personalizar Hustler',
    choose_color: 'Color de Indumentaria Táctica',
    choose_face: 'Máscara / Rostro de Combate',
    room_code: 'Código de Sala',
    create_room: 'CREAR SALA DE DISTRITO',
    join_room: 'UNIRSE CON CÓDIGO',
    invite_code: 'INTRODUCE EL CÓDIGO (ej. STREET101)',
    random_city: 'PARTIDA RÁPIDA EN CIUDAD',
    players_online: 'Jugadores en el Distrito',
    host_badge: 'LÍDER DE DISTRITO (ANFITRIÓN)',
    civilian_saved_alert: '¡Civil rescatado! +10 Respeto',
    player_down: '¡HERIDO DE GRAVEDAD! Médico en camino...',
    respawning: 'Reapareciendo en refugio...',
    controls_guide: 'WASD: Mover | RATÓN: Apuntar | CLICK: Disparar | E: Vehículo | Q: Cobertura | R: Recargar | B: Tienda',
    multiplayer_title: 'Guerra Urbana Multijugador',
    single_player_title: 'Campaña Individual',
  },

  pt: {
    game_title: 'Street Gang Star',
    intro_boss_name: 'Chefe da Quebrada',
    intro_call_1: 'Ei, os gângsteres estão assaltando a rua! Vá detê-los agora!',
    intro_call_2: 'Eles estão com fuzis laser pesados, motos e ônibus blindados. Os civis estão encurralados!',
    intro_call_3: 'Equipe-se, procure cobertura e neutralize os invasores. Limpe nossa rua agora!',
    mission_save: 'Missão: Salve os civis e derrote todos os assaltantes!',
    robber_alert: 'ALERTA: Invasão de gângsteres detectada por perto!',
    gun_shop: 'Arsenal Clandestino',
    betray_warning: 'TRAIÇÃO! Você atirou no seu próprio parceiro! Golpe sujo na rua!',
    team_join: 'Escolha Sua Facção',
    team_blue: 'SINDICATO AZUL (DEFENSORES)',
    team_red: 'CORSÁRIOS VERMELHOS (VALE TUDO)',
    team_blue_desc: 'Proteja os civis e derrote os invasores em grupo.',
    team_red_desc: 'Sem leis nem limites. Cada um por si.',
    switch_team: 'Mudar de Facção [T]',
    car_enter: 'Pressione E para Dirigir',
    car_exit: 'Pressione E para Desembarcar',
    car_hijacked: 'Veículo tomado do sindicato!',
    cover_active: 'EM COBERTURA (-80% Dano Laser)',
    cover_inactive: 'Abrigo Disponível [Q]',
    health: 'VIDA',
    ammo: 'MUNIÇÃO',
    coins: 'GRANA DA RUA',
    leaderboard: 'Placar de Líderes do Distrito',
    civilians_saved: 'Civis Salvos',
    gangsters_eliminated: 'Gângsteres Abatidos',
    weapon_pistol: 'Pistola Laser Padrão (10 DMG)',
    weapon_shotgun: 'Espingarda Laser Dispersão (25 DMG)',
    weapon_ak: 'AK-47 Laser Automática (15 DMG)',
    weapon_sniper: 'Sniper de Pulso Pesado (40 DMG)',
    insufficient_coins: 'Grana insuficiente! Abata gângsteres para faturar +5 moedas.',
    purchased: 'Arma Comprada e Pronta!',
    reload_alert: 'RECARREGANDO BATERIA LÁSER...',
    start_game: 'INICIAR MISSÃO',
    next: 'AVANÇAR',
    close: 'FECHAR',
    back: 'VOLTAR',
    exit_game: 'SAIR PARA A RUA',
    customize_avatar: 'Customizar Hustler',
    choose_color: 'Cor do Uniforme Tático',
    choose_face: 'Máscara / Rosto',
    room_code: 'Código da Sala',
    create_room: 'CRIAR NOVO DISTRITO',
    join_room: 'ENTRAR COM CÓDIGO',
    invite_code: 'INSIRA O CÓDIGO (ex. STREET101)',
    random_city: 'ENTRAR EM CIDADE ALEATÓRIA',
    players_online: 'Hustlers no Distrito',
    host_badge: 'LÍDER DO DISTRITO (HOST)',
    civilian_saved_alert: 'Cidadão salvo! +10 Respeito',
    player_down: 'FERIMENTO CRÍTICO! Paramédico a caminho...',
    respawning: 'Renascendo no esconderijo...',
    controls_guide: 'WASD: Mover | MOUSE: Mirar | CLIQUE: Atirar | E: Carro | Q: Abrigo | R: Recarregar | B: Loja',
    multiplayer_title: 'Guerra Urbana Multijogador',
    single_player_title: 'Campanha Solo',
  },

  zh: {
    ...{} as Record<GangStarTextKey, string>,
    ...({} as Record<GangStarTextKey, string>),
    game_title: '街头帮派之星', intro_boss_name: '街头老大', intro_call_1: '帮派分子正在抢劫街道！快去阻止他们！', intro_call_2: '他们有激光步枪、摩托车和装甲巴士，平民被困住了！', intro_call_3: '准备装备、寻找掩护并击败帮派头目！', mission_save: '任务：拯救平民并消灭所有入侵者！', robber_alert: '警告：附近发现帮派袭击！', gun_shop: '帮派武器商店', betray_warning: '背叛！你攻击了自己的队友！', team_join: '选择你的街头阵营', team_blue: '蓝色帮派（保卫街道）', team_red: '红色海盗（自由混战）', team_blue_desc: '保护平民并一起追捕劫匪。', team_red_desc: '各自为战，没有规则。', switch_team: '切换阵营 [T]', car_enter: '按 E 驾驶车辆', car_exit: '按 E 离开车辆', car_hijacked: '已夺取帮派司机的车辆！', cover_active: '掩护中（激光伤害降低 80%）', cover_inactive: '可寻找掩护 [Q]', health: '生命值', ammo: '弹药', coins: '街头现金', leaderboard: '城市帮派排行榜', civilians_saved: '已救助平民', gangsters_eliminated: '已击败帮派分子', weapon_pistol: '标准激光手枪', weapon_shotgun: '散射激光霰弹枪', weapon_ak: '快速自动激光 AK-47', weapon_sniper: '重型脉冲狙击枪', insufficient_coins: '街头现金不足！击败帮派分子赚取金币。', purchased: '武器已购买并装备！', reload_alert: '正在装填能量弹药……', start_game: '开始任务', next: '下一步', close: '关闭', back: '返回', exit_game: '退出街道', customize_avatar: '自定义角色', choose_color: '选择装备颜色', choose_face: '选择面具 / 面部', room_code: '房间代码', create_room: '创建新城市房间', join_room: '使用邀请代码加入', invite_code: '输入房间代码', random_city: '快速加入随机城市', players_online: '区域玩家', host_badge: '区域队长（房主）', civilian_saved_alert: '平民已获救！', player_down: '重伤！救援人员正在赶来……', respawning: '正在安全地点重生……', controls_guide: 'WASD：移动 | 鼠标：瞄准 | 点击：射击 | E：车辆 | Q：掩护 | R：装弹 | B：商店', multiplayer_title: '多人街区战争', single_player_title: '单人战役'
  },
  ko: {
    ...({} as Record<GangStarTextKey, string>),
    game_title: '스트리트 갱 스타', intro_boss_name: '스트리트 보스', intro_call_1: '갱스터들이 거리를 털고 있어요! 지금 막으세요!', intro_call_2: '레이저 소총과 오토바이, 장갑 버스가 있습니다. 시민들이 위험합니다!', intro_call_3: '장비를 갖추고 엄폐한 뒤 갱단 두목을 처치하세요!', mission_save: '임무: 시민을 구하고 침입자를 모두 제거하세요!', robber_alert: '경고: 근처에서 갱단 습격이 감지되었습니다!', gun_shop: '갱단 무기 상점', betray_warning: '배신! 팀원을 공격했습니다!', team_join: '거리 세력을 선택하세요', team_blue: '블루 신디케이트 (거리 방어)', team_red: '레드 코르세어 (자유 전투)', team_blue_desc: '시민을 보호하고 강도들을 함께 추적하세요.', team_red_desc: '각자 생존하세요. 규칙은 없습니다.', switch_team: '세력 변경 [T]', car_enter: 'E 키를 눌러 운전', car_exit: 'E 키를 눌러 차량에서 내리기', car_hijacked: '신디케이트 운전자의 차량을 탈취했습니다!', cover_active: '엄폐 중 (레이저 피해 80% 감소)', cover_inactive: '엄폐 가능 [Q]', health: '체력', ammo: '탄약', coins: '스트리트 캐시', leaderboard: '도시 신디케이트 순위', civilians_saved: '구출한 시민', gangsters_eliminated: '제거한 갱스터', weapon_pistol: '기본 레이저 권총', weapon_shotgun: '확산 레이저 샷건', weapon_ak: '연사 레이저 AK-47', weapon_sniper: '중형 펄스 저격총', insufficient_coins: '스트리트 캐시가 부족합니다!', purchased: '무기를 구매하고 장착했습니다!', reload_alert: '레이저 배터리 충전 중...', start_game: '임무 시작', next: '다음', close: '닫기', back: '뒤로', exit_game: '거리 나가기', customize_avatar: '캐릭터 꾸미기', choose_color: '전술 장비 색상', choose_face: '전투 마스크 / 얼굴', room_code: '방 코드', create_room: '새 도시 방 만들기', join_room: '초대 코드로 참가', invite_code: '방 코드 입력', random_city: '랜덤 도시 빠른 참가', players_online: '지역 플레이어', host_badge: '지역 리더 (호스트)', civilian_saved_alert: '시민을 구했습니다!', player_down: '치명상! 구조대가 오고 있습니다...', respawning: '안전 구역에서 부활 중...', controls_guide: 'WASD: 이동 | 마우스: 조준 | 클릭: 발사 | E: 차량 | Q: 엄폐 | R: 재장전 | B: 상점', multiplayer_title: '멀티플레이어 거리 전쟁', single_player_title: '싱글 플레이 캠페인'
  },
  he: {
    ...({} as Record<GangStarTextKey, string>),
    game_title: 'כוכב כנופיות הרחוב', intro_boss_name: 'בוס הרחוב', intro_call_1: 'הגנגסטרים שודדים את הרחוב! צא לעצור אותם!', intro_call_2: 'יש להם רובי לייזר, אופנועים ואוטובוסים משוריינים. האזרחים לכודים!', intro_call_3: 'הצטייד, מצא מחסה וחסל את מנהיגי הכנופיה!', mission_save: 'משימה: הצילו אזרחים וחסלו את כל הפולשים!', robber_alert: 'אזהרה: זוהתה פשיטת כנופיה בקרבת מקום!', gun_shop: 'חנות הנשק של הסינדיקט', betray_warning: 'בגידה! ירית בחבר הצוות שלך!', team_join: 'בחר את סיעת הרחוב שלך', team_blue: 'הסינדיקט הכחול (הגנת הרחוב)', team_red: 'הקורסארים האדומים (כולם נגד כולם)', team_blue_desc: 'הגן על האזרחים ורדוף אחר השודדים יחד.', team_red_desc: 'כל אחד לעצמו. אין חוקים.', switch_team: 'החלף סיעה [T]', car_enter: 'לחץ E לנהיגה', car_exit: 'לחץ E ליציאה מהרכב', car_hijacked: 'הרכב נלקח מנהג הסינדיקט!', cover_active: 'במחסה (80% פחות נזק לייזר)', cover_inactive: 'מחסה זמין [Q]', health: 'בריאות', ammo: 'תחמושת', coins: 'כסף רחוב', leaderboard: 'טבלת מובילי הסינדיקט', civilians_saved: 'אזרחים שניצלו', gangsters_eliminated: 'גנגסטרים שחוסלו', weapon_pistol: 'אקדח לייזר רגיל', weapon_shotgun: 'רובה לייזר מפזר', weapon_ak: 'רובה לייזר אוטומטי AK-47', weapon_sniper: 'רובה צלפים כבד', insufficient_coins: 'אין מספיק כסף רחוב!', purchased: 'הנשק נרכש וצויד!', reload_alert: 'טעינת סוללת הלייזר...', start_game: 'התחל משימה', next: 'הבא', close: 'סגור', back: 'חזרה', exit_game: 'צא לרחוב', customize_avatar: 'התאם אישית דמות', choose_color: 'צבע ציוד טקטי', choose_face: 'מסכת קרב / פנים', room_code: 'קוד חדר', create_room: 'צור חדר עיר חדש', join_room: 'הצטרף באמצעות קוד הזמנה', invite_code: 'הזן קוד חדר', random_city: 'הצטרפות מהירה לעיר אקראית', players_online: 'שחקנים באזור', host_badge: 'מוביל האזור (מארח)', civilian_saved_alert: 'אזרח ניצל!', player_down: 'פציעה קשה! צוות רפואי בדרך...', respawning: 'מתחדש בבית בטוח...', controls_guide: 'WASD: תנועה | עכבר: כיוון | לחיצה: ירי | E: רכב | Q: מחסה | R: טעינה | B: חנות', multiplayer_title: 'מלחמת רחובות מרובת משתתפים', single_player_title: 'מערכה לשחקן יחיד'
  },
};

/**
 * Primary accessor for localized Street Gang Star strings
 * @param lang - Target language ('en', 'fr', 'ar', 'pidgin'/'pcm', 'es', 'pt')
 * @param key - Translation key
 * @returns Localized string, falling back to English if missing
 */
export function getGangStarText(lang: string | undefined | null, key: GangStarTextKey): string {
  const normalized = (lang || 'en').toLowerCase().trim();
  const effectiveLang: string =
    normalized === 'pcm' || normalized === 'pidgin'
      ? 'pidgin'
      : TRANSLATIONS[normalized]
      ? normalized
      : 'en';

  const dict = TRANSLATIONS[effectiveLang] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}
