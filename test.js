const https = require("https");
const options = {
    protocol:"https:",
    method:"POST",
    host:"httpbin.org",
    path:"/post",
    headers:{
        "Content-Type": "application/json"
    }
}
const request = https.request(options,response => {
    console.log(`statusCode: ${response.statusCode}`);
    }
  );

request.write(JSON.stringify({text:`test post request`}));
request.end();