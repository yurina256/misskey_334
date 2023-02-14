//-------定数--------------------------------
const https = require("https");
const TOKEN = process.env.misskey_token; //todo:直書きをやめる
const HOST = process.env.misskey_host;
console.log(`token:${process.env.misskey_token}`);
const LTL_ENDPOINT = `wss://${HOST}/streaming?i=${TOKEN}`;
const POST_ENDPOINT = `https://${HOST}/api/notes/create`;
const WebSocketClient = require('websocket').client;
const client = new WebSocketClient();
const readtime = 120 * 1000 //起動からのノート収集の限界(ミリ秒)
const today = new Date();
const targettime = new Date(today.getFullYear(),today.getMonth(),today.getDate(),3,34,0,0); //目標タイム 0ミリ以外は判定でバグる
console.log(`targettime:${targettime.toString()}`);

    //システムメッセージ
    const msg = {
        connect:"チャンネルに接続します！",
        close:"チャンネルから切断……"
    }

    //接続に使うやつ
    const ch_connect_obj = {
        type: 'connect',
        body: {
            channel: 'localTimeline',
            id: 'hogehuga'
        }
    }

    //グローバル変数
        //記録(arr[i] = {id:[note id],time:[時刻(Date Object)],name:[username]})
        var record = [];
        //参加ユーザID(重複除去処理用)
        var participant = {};

//--------エラーハンドリング(雑)--------------

process.on('uncaughtException', function(err) {
    console.log(err);
});

client.on('connectFailed', function(error) {
    console.log('えらー: ' + error.toString());
});

//--------起動時投稿---------------------------
function start_up(){
    const options = {
        method:"POST",
        headers:{
            "Content-Type": "application/json"
        }
    }
    const request = https.request(POST_ENDPOINT, options, response => {
        console.log(`statusCode: ${response.statusCode}`)
      });

    request.write(JSON.stringify({i:TOKEN,text:`334観測中(${today.toLocaleDateString()})`}));
    request.end();
}
start_up();
//---------本体(収集)------------------------------


    //接続
    client.on('connect', function(connection){

        //初期処理
        console.log(msg.connect);
        connection.send(JSON.stringify(ch_connect_obj));
    
        //受信
        connection.on('message', function(message) {
            const note = JSON.parse(message.utf8Data).body.body;
            //console.log(note);
            if(is_target(note) && !participant[note.userId]){
                console.log(`valid:${note.user.username}`);
                var time = new Date(note.createdAt);
                const record_obj = {
                    id:note.id,
                    time:time,
                    name:note.user.name,
                    username:note.user.username
                }
                participant[note.user.id] = true;
                record.push(record_obj);
            }
        });
    
        //エラー
        connection.on('error', function(error) {
            console.log("Connection Error: " + error.toString());
        });
        
        //規定の秒数集計したら、切断して集計処理に入る
        function close_connection(){
            connection.close();
            totalization();
        }
        setTimeout(close_connection,readtime);
    });
    client.connect(LTL_ENDPOINT);

    //収集対象ノートかの判定
    function is_target(note){
        if(note.text == null) return false;
        if(note.text.match(/(33-?4|:hanshin:)/)){
            return true;
        }
        return false;
    }

//----------本体(集計)-------------------------------
function totalization(){
    //DQと+1分以上の排除をしてソート
    var record_without_DQ = [];
    var record_DQ = [];//フライングを保存する　今のところは特に読まない
    record.forEach((obj) => {
        //console.log(obj.time.getTime(),targettime.getTime());
        if(obj.time.getTime() < targettime.getTime()){
            record_DQ.push(obj);
        }else if(obj.time.getTime() < targettime.getTime() + (60 * 1000)){
            record_without_DQ.push(obj);
        }
    });
    record_without_DQ.sort((a,b) => {return a.time.getTime() - b.time.getTime()});
    console.log(`有効投稿数:${record_without_DQ.length}`);
    console.log(`フライング投稿数:${record_DQ.length}`);
    post(record_without_DQ);
}

//----------本体(投稿)-------------------------------
function post(record){
    //---------投稿文面作成-------------------------------
    if(record.length==0) return 0;

    var post_text = `Todays Top ${Math.min(10,record.length)}\n\n`;
    var emozi = [
    "",
    "🥇",
    "🥈",
    "🥉",
    "4⃣",
    "5⃣",
    "6⃣",
    "7⃣",
    "8⃣",
    "9⃣",
    "🔟"
    ];
    for(var i=1;i<=Math.min(10,record.length);i++){
        const seconds = record[i-1].time.getSeconds();
        const milliseconds = record[i-1].time.getMilliseconds();

        //n位タイの処理
        if(i!=1){
            if(record[i-1].time.getTime() == record[i-2].time.getTime()){
                emozi[i-1] = emozi[i-2];
            }
        }

        post_text += `${emozi[i]} @${record[i-1].username} +${seconds}.${milliseconds}s\n`;
    }
    console.log(post_text);

    //----------------投稿------------------------------
    const options = {
        method:"POST",
        headers:{
            "Content-Type": "application/json"
        }
    }
    const request = https.request(POST_ENDPOINT, options, response => {
        console.log(`statusCode: ${response.statusCode}`)
      });

    request.write(JSON.stringify({i:TOKEN,text:post_text}));
    request.end();
}
