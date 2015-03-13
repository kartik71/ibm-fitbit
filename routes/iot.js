//BlueMix hands us our service connection data in the VCAP_SERVICES variable
var env = JSON.parse(process.env.VCAP_SERVICES);
var iotprops = {};

//When the login page POSTs, we get the Wearable API auth info and the client
//browser timezone - caveat is that a user in a different tz than the FitBit
//will not get fully appropriate results based on time of day, although the
//FitBit data itself *will* be correct, just our app assumptions will be wrong
exports.getDeviceData = function(req, res) {
    var user = req.body.username;
    var pw = req.body.pw;
    var tzoffset = -(req.body.tzoffset);

    //look at the VCAP_SERVICES variable and grab the credentials for the
    //Wearable IoT service
    getCredentials(env, 'Wearable');

    var curDateTime = getClientCurrentDateTime(tzoffset);

    //calculate the percentage of "today" that is gone for our status page
    var percentOfDay = curDateTime.getHours()*60 + curDateTime.getMinutes();
    percentOfDay = percentOfDay / (24*60) * 100;

    //call the Wearable API for today's data, and then render the response page
    queryFitbitData(user, pw, currentDateToYMDForm(curDateTime),
                    function(respData) {
                      //check for error codes:
                      if (!handleError(respData, curDateTime)) {
                        //if no errors, augment data with added display info
                        var dayMsgIndex = Math.ceil(percentOfDay/100*4 - 1);
                        var percentGoal = respData.summary.steps/respData.goals.steps;
                        //since you can surpass the goal in steps, max at "100%" response
                        var goalMsgIndex = Math.min(Math.ceil(percentGoal*4 - 1), 3);
                        respData["welcome_msg"] = messages.welcome_messages[dayMsgIndex][goalMsgIndex];
                        respData["daypercent"] = percentOfDay;
                      }

                      res.render('iotview', respData)
                    });

};

function getClientCurrentDateTime(tzOffset) {
    //get the server's offset in hours
    var tmpDateObj = new Date();
    var srvOffset = tmpDateObj.getTimezoneOffset()/60;
    //to get local client time take the client's offset + server's offset
    var actualOff = tzOffset+srvOffset;
    //now get the actual date by getting time in ms and adding the offset ms
    var dateObj = new Date( new Date().getTime() + (actualOff * 3600 * 1000));
    return dateObj;
}

function currentDateToYMDForm(dateObj) {

    //IoT API wants YYYY-MM-DD; generate that from the date obj
    var day = dateObj.getDate();
    var mon = dateObj.getMonth() + 1;
    var year = dateObj.getFullYear();
    return '' + year + '-' +
           (mon <= 9 ? '0' + mon : mon) + '-' +
           (day <= 9 ? '0' + day : day);
}

function queryFitbitData(username, password, datestr, callbackFn) {

    var restcall = require('../restcall');
    var url = require('url');

    var iotURLObj = url.parse(iotprops.url);
    var host = iotURLObj.host;
    var authStr = username+":"+password;
    //switch to IOT 1.2 API endpoint due to problems with 1.0
    var endpoint = "/iotlabs1.2/doc?id="+username+":fb_activity_"+datestr+"&appId="+iotprops.appId;

    var options = {
      host: host,
      path: endpoint,
      method: "GET",
      auth: authStr
    };

    console.log("URL: "+host+" / Endpoint: "+endpoint);

    //send the request to the IoT API
    restcall.get(options, true, callbackFn);
}

function handleError(respData, curDateTime) {
  var errorCondition = false;

  if (typeof respData.httpCode !== "undefined") {
    errorCondition = true;
    console.log("Wearable API Error: code "+respData.httpCode);
    if (respData.httpCode == 400) {
      //we didn't get any results--one option is the "just
      //after midnight" problem where the Wearable API hasn't
      //pulled any data yet for the current date
      if (curDateTime.getHours() === 0) {
        //let's put up a message that no data is available yet
        respData["no_data"] = "early";
      } else {
        //could be an API endpoint or server/internet issue:
        //temporarily down/having issues
        respData["no_data"] = "error";
      }
    } else if (respData.httpCode == 401) {
      //log in failed, report this specifically so end user knows
      respData["no_data"] = "login";
    } else {
      //other unknown error code--just report it
      respData["no_data"] = "error";
    }
  }
  return errorCondition;
}

function getCredentials(vcapEnv, serviceNameStr) {

    vcapEnv['user-provided'].forEach(function(service) {
      if (service.name.indexOf(serviceNameStr) === 0) {
          iotprops = service.credentials;
      }
    });
}

//simple method for storing cheesy messages to offer the end user, depending
//on time of day (broken into 4 quadrants) and percent of goal met (also
//divided into 4 quadrants), giving us a 4x4 matrix of messages, which some
//simple math on the fitbit data will give us an offset into
var messages = { "welcome_messages" :
   [
    [ "You are probably still asleep..you'll have plenty of time to get steps later.",
      "Walking in your sleep again?",
      "Wow--burning the midnight oil I guess?!",
      "You've already met your goal before most people are awake for the day..bravo!"
    ],
    [ "Maybe you should think about getting some movement in before long..take a quick break!",
      "You're basically right on track to meet your goal!",
      "Great job.. you are well on your way to exceeding today's step goal!",
      "Looks like you will be an overachiever today."
    ],
    [ "You've got some serious ground to cover, literally!  Might want to look up a place to hike later.",
      "Falling behind a bit.. step it up (no pun intended).",
      "Doing well, keep it up!",
      "Looks like you can meet your goal AND sit and watch TV all evening!"
    ],
    [ "Not much time left--better get moving!",
      "Still need to get in quite a few steps before you relax.. time for an evening walk?",
      "Almost there, just a little more activity and you've met your goal!",
      "Looks like a good day for meeting your goals!"
    ]
   ]
};
