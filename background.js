const QUERY_INTERVAL = 10;
const userIdList =
  [
    {
      "uid": 672346917,
      "nickname": "ava",
    },
    {
      "uid": 672353429,
      "nickname": "bella",
    },
    {
      "uid": 351609538,
      "nickname": "carol",
    },
    {
      "uid": 672328094,
      "nickname": "diana",
    },
    {
      "uid": 672342685,
      "nickname": "eileen",
    },
    {
      "uid": 703007996,
      "nickname": "A-SOUL_Official",
    }
  ];

const SPACE_HISTORY_PREFIX = "https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/space_history?host_uid="
//const SPACE_HISTORY_PREFIX = "http://localhost?host_uid="
class DynamicCard {
  constructor(uid, uname, type, timestamp, face, dynamicId) {
    this.uid = uid;
    this.uname = uname;
    this.type = type;
    this.timestamp = timestamp;
    this.face = face;
    this.dynamicId = dynamicId;
  }
}

(async () => {
  const [{ queryInterval }, alarm] = await Promise.all([chrome.storage.local.get(['queryInterval']), chrome.alarms.get("queryDynamic")]);
  await Promise.all([
    (async () => {
      if (queryInterval == null) {
        console.log("init storage");
        await Promise.all([
          chrome.storage.local.set({ queryInterval: QUERY_INTERVAL }),
          chrome.storage.local.set({ userIdList }),
          chrome.storage.local.set({ oldQueries: {} }),
        ]);
      }
    })(),
    (async () => {
      if (alarm == null) {
        console.log("init alarm");
        await chrome.alarms.create("queryDynamic", { delayInMinutes: QUERY_INTERVAL, periodInMinutes: QUERY_INTERVAL });
      }
    })()
  ]);
  chrome.storage.onChanged.addListener(async ({queryInterval}) => {
    if (queryInterval) {
      console.log("query interval changed, reset alarm");
      const queryAlarm = await chrome.alarms.get("queryDynamic");
      if (queryAlarm != null) {
        await chrome.alarms.clear(queryAlarm.name);
      }
      chrome.alarms.create("queryDynamic", { delayInMinutes: queryInterval.newValue, periodInMinutes: queryInterval.newValue });
    }
  });
})();

chrome.notifications.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    if (buttonIndex === 1) {
      chrome.tabs.create({
        url: `https://t.bilibili.com/${notificationId.split('_')[0]}`
      });
    }
  }
)

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "queryDynamic") {
    updateDynamic();
  }
});

async function queryDynamic(userIdList) {
  console.log("query dynamics of:", userIdList.map(user => user.nickname).join(', '))
  let userQueries = new Map();
  for (const user of userIdList) {
    try {
      const cards = (await queryUid(user.uid)).data.cards;
      const uname = cards[0].desc.user_profile.info.uname;
      const face = cards[0].desc.user_profile.info.face;
      let dynamicCards = [];
      for (const card of cards) {
        const type = card.desc.type;
        const dynamicId = card.desc.dynamic_id_str;
        const timestamp = card.desc.timestamp;
        const dynamicCard = new DynamicCard(user.uid, uname, type, timestamp, face, dynamicId);
        dynamicCards.push(dynamicCard);
      }
      userQueries.set(user.uid, dynamicCards);
    } catch (error) {
      console.error(error);
    }
  }
  return userQueries;
}

async function queryUid(uid) {
  const url = SPACE_HISTORY_PREFIX + uid;
  const response = await fetch(url, {
    method: 'GET', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-store', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'text/plain'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

async function sendNotification(dynamic_id, uname, type, timestamp, face) {
  let message = uname + `在${Math.floor((Date.now() / 1000 - timestamp) / 60)}分钟前`;
  switch (type) {
    case 1:
      message += "转发了动态";
      break;
    case 8:
      message += "投稿了新视频";
      break;
    case 16:
      message += "投稿了新视频";
      break;
    case 64:
      message += "投稿了新专栏";
      break;
    default:
      message += "有了新动态";
  }
  chrome.notifications.create(`${dynamic_id}_${type}_${timestamp}`, {
    type: 'basic',
    iconUrl: face,
    title: '成员新动态提醒',
    message: message,
    priority: 1,
    silent: true,
    buttons: [
      {
        title: '知道啦'
      },
      {
        title: '前往动态'
      }
    ]
  })
}

async function updateDynamic() {
  const { oldQueries, userIdList } = await chrome.storage.local.get(["oldQueries", "userIdList"]);
  const userQueries = await queryDynamic(userIdList);
  if (userQueries.length === 0) {
    console.error("Error during fetching user dynamics!")
  }
  for (const [uid, dynamicCards] of userQueries) {
    if (uid in oldQueries) {
      let newDynamicFlag = false;
      const dynamic_ids_set = new Set(oldQueries[uid]);
      for (const card of dynamicCards) {
        const dynamicId = card.dynamicId;
        if (!dynamic_ids_set.has(dynamicId)) {
          // new dynamic
          console.log("new dynamic");
          newDynamicFlag = true;
          sendNotification(dynamicId, card.uname, card.type, card.timestamp, card.face);
        }
      }
      if (newDynamicFlag) {
        oldQueries[uid] = dynamicCards.map(card => card.dynamicId);
        chrome.storage.local.set({ oldQueries });
      }
    }
    else {
      //uid not in oldQueries
      console.log('new uid');
      oldQueries[uid] =  dynamicCards.map((card) => card.dynamicId);
      chrome.storage.local.set({ oldQueries });
    }
  }
}