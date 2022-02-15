let queryIntervalNode = document.getElementById("queryInterval");
let userIdListNode = document.getElementById("userIdList");
let responseNode = document.getElementById("response");

chrome.storage.local.get(["queryInterval"], ({ queryInterval }) => { queryIntervalNode.value = queryInterval; })
chrome.storage.local.get(["userIdList"], ({ userIdList }) => { userIdListNode.innerText = userIdList.map(({ uid, nickname }) => `${uid}:${nickname}`).join('\n'); })
document.getElementById("submitButton").addEventListener("click", set);
document.getElementById("clearButton").addEventListener("click", clearInput);

function set() {
    let queryInterval = parseInt(queryIntervalNode.value.trim());
    let userIdList = userIdListNode.innerText.trim().split('\n').map(pair => (pair.split(':'))).map(([uid, nickname]) => {
        return {
            uid, // string
            nickname
        }
    }
    );
    responseNode.innerHTML = "Submitted!"

    chrome.storage.local.set({ queryInterval });
    chrome.storage.local.set({ userIdList });
    updateOldQueries(userIdList);
}

async function updateOldQueries(userIdList) {
    const { oldQueries } = await chrome.storage.local.get(["oldQueries"]);
    const oldUIDs = Object.getOwnPropertyNames(oldQueries);
    const newUIDSet = new Set(userIdList.map(userObj => userObj.uid))
    const toBeDelete = new Set(oldUIDs.filter(x => !(newUIDSet.has(x))))
    toBeDelete.forEach(function (uid) {
        delete oldQueries[uid]
    })
    chrome.storage.local.set({ oldQueries });
}

function clearInput() {
    queryIntervalNode.value = "";
    userIdListNode.value = "";
    responseNode.innerHTML = "";
}
