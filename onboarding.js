/*+-+-+ +-+-+-+-+-+ +-+-+
|U|X| |S|l|a|c|k| |B|O|T|
+-+-+ +-+-+-+-+-+ +-+-+*/
// This is a UXbot; a slack app for GSIUXD slack community. 

//Slack App configuration for multiple team  
var Botkit = require('./lib/Botkit.js');


// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 8080;


if (!process.env.clientId || !process.env.clientSecret/* || !process.env.PORT*/) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

// Botkit-based Redis store
var Redis_Store = require('./redis_storage.js');
var redis_url = process.env.REDISCLOUD_URL ||"redis://127.0.0.1:6379"
var redis_store = new Redis_Store({url: redis_url});


//var mongoStorage = require('botkit-storage-mongo')({mongoUri: process.env.MONGODB_URI});

var controller = Botkit.slackbot({
  storage: redis_store,
  //storage: mongoStorage
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot'],
  }
);


// setup web server
controller.setupWebserver(process.env.PORT || 8080,function(err,webserver) {

  webserver.get('/',function(req,res) {
    res.sendFile('index.html', {root: __dirname});
  });

  controller.createWebhookEndpoints(controller.webserver);

  controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send('Success!');
    }
  });
});

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

// interactive message callback
controller.on('interactive_message_callback', function(bot, message) {

    var ids = message.callback_id.split(/\-/);
    var user_id = ids[0];
    var item_id = ids[1];

    controller.storage.users.get(user_id, function(err, user) {

        if (!user) {
            user = {
                id: user_id,
                list: []
            }
        }

        for (var x = 0; x < user.list.length; x++) {
            if (user.list[x].id == item_id) {
                if (message.actions[0].value=='flag') {
                    user.list[x].flagged = !user.list[x].flagged;
                }
                if (message.actions[0].value=='delete') {
                    user.list.splice(x,1);
                }
            }
        }


        var reply = {
            text: 'Here is <@' + user_id + '>s list:',
            attachments: [],
        }

        for (var x = 0; x < user.list.length; x++) {
            reply.attachments.push({
                title: user.list[x].text + (user.list[x].flagged? ' *FLAGGED*' : ''),
                callback_id: user_id + '-' + user.list[x].id,
                attachment_type: 'default',
                actions: [
                    {
                        "name":"flag",
                        "text": ":waving_black_flag: Flag",
                        "value": "flag",
                        "type": "button",
                    },
                    {
                       "text": "Delete",
                        "name": "delete",
                        "value": "delete",
                        "style": "danger",
                        "type": "button",
                        "confirm": {
                          "title": "Are you sure?",
                          "text": "This will do something!",
                          "ok_text": "Yes",
                          "dismiss_text": "No"
                        }
                    }
                ]
            })
        }

        bot.replyInteractive(message, reply);
        controller.storage.users.save(user);


    });

});

// Bot replies to the person via dm who invites the bot into the channel
controller.on('create_bot',function(bot,config) {

  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot);
      }

      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          console.log(err);
        } else {
          convo.say('Thank you so much for inviting me into this channel.');
          convo.say('I am your Slackbot for GSIUXD community.');
        }
      });

    });
  }

});


// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});


// Bot hears "hello there"
controller.hears(['hello there'], 'direct_message,direct_mention,mention', function(bot, message) {
    var userID = message.user 
    bot.reply(message, 'Can I help you, ' + message.user + '?');
});


// greet new nembers when then join #general

var greet = "_Hello There_ :tada:! I am your Slackbot :space_invader: , and Welcome to GSIUXD - Get Started in UX Design.\n\n\n:rocket: This design community has mentors, learners, designers, and engineers and everyone in between. The primary goal of this UX group is to help each other learn and level up our collective design skills.\n\n\n:rocket: _Give your short intro_ in #member_introductions that will help us to know about you, where you work, and what are your expectations from this community.\n\n\n:rocket: _About our channels_\n<#C0L8M4D0V> - Common talk\n<#C0LLFQD4Y> - Post design jobs, or discuss anything that relates to your career\n<#C0M2W80J1> - Online and offline UX related events\n<#C0LLE7JL9> - Ask a question that doesn't fit in any of our other channels\n<#C0LLE9J9X> - Share interesting stuff like design articles\n<#C0LLQ26NA> - Design tools and resources\n<#C0R43MBGS> - Get feedback for your designs\n<#C4K141RLY> - UX books you have read, wish to read, and discussions\n<#C4NCLSRTJ> - Best practices on user research\n<#C4PNLBJJG> - Discuss everything about visual design\n<#C4PNLMNTW> - Level up your design game\n<#C4PNLK4KW> - Sketches, wireframes, prototypes\n<#C4QCEMMF1> - Discuss how to test the products you build with users"

greet += "\n\n\nAlso, please ask me specific questions as I am not 100% built for human. Feel free to try me!\n\n\n:rocket: Get all UX conversations on the go by downloading our *<https://slack.com/downloads/|Slack App>*"

controller.on('team_join', function(bot, message){
  console.log(message)
  bot.say({channel: message.user.id, text: greet});
});


// Bot hears "slack community promotion" and shares an attachment 
controller.hears('community promotion','direct_message,direct_mention',function(bot,message) {
  var reply_with_attachments = {
    'username': 'UX Bot' ,
    'text': 'This an example of a featured image.',
    'attachments': [
      {
        'fallback': 'Would you like to see other featured images like this?',
        'title': 'GSIUXD Featured Image Number 04',
        'image_url': "https://raw.githubusercontent.com/abinashmohanty/slack-chat-bot/master/img/img-demo-gsiuxd-slack-medium.png",
        'thumb_url': "https://cdn-img.easyicon.net/png/11965/1196550.gif",
        'text': 'You can preview or download this image at anytime.',
        'color': 'default' // consider using optional color values "good (green)", "warning" (dark yellow), or "danger" (red). User "default" for grey.
      }
    ],
    'icon_url': 'http://lorempixel.com/48/48',
    'icon_emoji': ':robot_face:'
    }

  bot.reply(message, reply_with_attachments);
});


controller.hears(['hi', 'hello', 'hey', 'hi bot', 'you there'], ['direct_message','direct_mention','mention'], function (bot, message) {

  // start a conversation to handle this response.
  bot.startConversation(message,function(err,convo) {

    convo.say('Hello!');
    convo.say('I am here!');

  });
});

// let me introduce @uxbot
controller.hears(["introduce our slackbot"], [ 'direct_message','direct_mention','mention'], function (bot, message) {

bot.reply(message, "Thank you :thumbsup:");
});

/* Bot hears ux invite and conform via conversation */
controller.hears(['get gsiuxd invite', 'to invite someone', 'add into this group', 'gsiuxd invite','slack invite', 'ux slack invite', 'group invite'], ['ambient', 'direct_message','direct_mention','mention'], function (bot, message) {

  // start a conversation to handle this response.
  bot.startConversation(message,function(err,convo) {

    convo.ask('Are you looking out for our Slack invite? Say `YES` or `NO`',[
      {
        pattern: bot.utterances.yes,
        callback: function(response,convo) {
          convo.say('Okay!');
          convo.say('Here is our *<https://gsiuxd.herokuapp.com/|GSIUXD Slack Invite>*');
          // do something else...
          convo.next();

        }
      },
      {
        pattern: bot.utterances.no,
        //default: true,
        callback: function(response,convo) {
          convo.say('Okay!');
          // do something else...
          convo.next();
        }
      },
      {
        pattern: 'quit',
        default: true,
        callback: function(response,convo) {
          //conclude a message before quitting 
          convo.say("I didn't understand this. Let me skip this question for now.");
          convo.next(); // move to the next convo and stop the conversation 
        }
      },
      {
          callback: function(response,convo) {
          convo.stop(); // current conversation stops here 
          }
      },

      {
        //default: true,
        callback: function(response,convo) {
          // just repeat the question
          convo.repeat();
          convo.next();
        }
      }
    ]);

  })

});

// Replies to lol, haha, and funny words
controller.hears(['LOL','lmao','LMAO','omg','LOL','lolz','lol.','haha','HAHA','hahahahahaha','bahahaahah','hehe'], ['direct_message','direct_mention','mention'], function(bot, message) {
    var message_options = [
    	"I'm still learning emotions :thought_balloon:",
        "What's this? :thought_balloon:",
        "Still need to understand emotions :thought_balloon:",
        "Let me think :thought_balloon:",
        "Should I laugh :thought_balloon:",
        "What does it mean :thought_balloon:",
    	"Hmmmmm.... :thought_balloon:"
	]
	var random_index = Math.floor(Math.random() * message_options.length)
	var chosen_message = message_options[random_index]

  bot.reply(message, chosen_message)
    // do something here, the "is typing" animation is visible

});

// Replies to users when they feel sorry about something
controller.hears(['oops','oops!','my bad','sorry', 'sorry!'], ['direct_message','direct_mention','mention'], function(bot, message) {

    var message_options = [
        "It's Okay.",
        "It's Fine.",
        "No Problem.",
        "That's fine."
    ]
    var random_index = Math.floor(Math.random() * message_options.length)
    var chosen_message = message_options[random_index]

    bot.reply(message, chosen_message)
  // do something here, the "is typing" animation is visible

});

// bot hears negative keywords 
controller.hears(['anus','arse','arsehole','ass', 'ass-hat','ass-jabber','assbag','asscock', 'assclown', 'asscock','assfuck','assface','asshat','asshead', 'asshole','assshit','assshole','asssucker', 'Whore', 'motherfucker','mother fucker'], ['direct_message','direct_mention','mention'], function(bot, message) {

  bot.api.reactions.add({
      timestamp: message.ts,
      channel: message.channel,
      name: 'no_entry_sign',
  }, function(err, res) {
      if (err) {
          bot.botkit.log('Failed to add emoji reaction :(', err);
      }
  });

  controller.storage.users.get(message.user, function(err, user) {
      if (user && user.name) {
          bot.reply(message, 'Hello ' + user.name + '!!');
      } else {
          bot.reply(message, "These words are no allowed in here!" );
      }
  });

});


// React to phraes like thanks 
controller.hears(['Okay','cool','wow','superb', 'excellent','hm.','hm..','i see', 'alright', 'ok','yes'], ['direct_message','direct_mention','mention'], function(bot, message) {

  bot.api.reactions.add({
      timestamp: message.ts,
      channel: message.channel,
      name: 'thumbsup',
  }, function(err, res) {
      if (err) {
          bot.botkit.log('Failed to add emoji reaction :(', err);
      }
  });

});

// Replies  to phraese like Welcome, Don't mention, etc when hear thank you, etc.
controller.hears(['Thanks','thx','thank u','thank you','thanks a lot', 'thanks man', 'thank you so much'], ['direct_message','direct_mention','mention'], function(bot, message) {
    var message_options = [
    	"You got it",
    	"Don’t mention it",
        "Not a problem",
        "No worries",
        "My pleasure",
        "I’m happy to help",
    	"Anytime"
	]
	var random_index = Math.floor(Math.random() * message_options.length)
	var chosen_message = message_options[random_index]

  bot.reply(message, chosen_message)
    // do something here, the "is typing" animation is visible

});

//add to list 
controller.hears(['add (.*)'],'direct_mention,direct_message',function(bot,message) {

    controller.storage.users.get(message.user, function(err, user) {

        if (!user) {
            user = {
                id: message.user,
                list: []
            }
        }

        user.list.push({
            id: message.ts,
            text: message.match[1],
        });

        bot.reply(message,'Added to list. Say `list` to view or manage list.');

        controller.storage.users.save(user);

    });
});

// create list 
controller.hears(['list','tasks'],'direct_mention,direct_message',function(bot,message) {

    controller.storage.users.get(message.user, function(err, user) {

        if (!user) {
            user = {
                id: message.user,
                list: []
            }
        }

        if (!user.list || !user.list.length) {
            user.list = [
                {
                    'id': 1,
                    'text': 'Test Item 1'
                },
                {
                    'id': 2,
                    'text': 'Test Item 2'
                },
                {
                    'id': 3,
                    'text': 'Test Item 3'
                }
            ]
        }

        var reply = {
            text: 'Here is your list. Say `add <item>` to add items.',
            attachments: [],
        }

        for (var x = 0; x < user.list.length; x++) {
            reply.attachments.push({
                title: user.list[x].text + (user.list[x].flagged? ' *FLAGGED*' : ''),
                callback_id: message.user + '-' + user.list[x].id,
                attachment_type: 'default',
                actions: [
                    {
                        "name":"flag",
                        "text": ":waving_black_flag: Flag",
                        "value": "flag",
                        "type": "button",
                    },
                    {
                       "text": "Delete",
                        "name": "delete",
                        "value": "delete",
                        "style": "danger",
                        "type": "button",
                        "confirm": {
                          "title": "Are you sure?",
                          "text": "This will do something!",
                          "ok_text": "Yes",
                          "dismiss_text": "No"
                        }
                    }
                ]
            })
        }

        bot.reply(message, reply);

        controller.storage.users.save(user);

    });

});

//interactive message 
controller.hears('interactive', 'direct_message', function(bot, message) {

    bot.reply(message, {
        attachments:[
            {
                title: 'Do you want to interact with my buttons?',
                callback_id: '123',
                attachment_type: 'default',
                actions: [
                    {
                        "name":"yes",
                        "text": "Yes",
                        "value": "yes",
                        "type": "button",
                    },
                    {
                        "name":"no",
                        "text": "No",
                        "value": "no",
                        "type": "button",
                    }
                ]
            }
        ]
    });
});

//shut down the bot
controller.hears('^stop','direct_message',function(bot,message) {
  bot.reply(message,'Goodbye');
  bot.rtm.close();
});


// Bot doesn't understand the phrases
controller.hears(".*", ["direct_message", "direct_mention",'mention'], function (bot, message) {

  var message_options = [
    "Sorry! I don't understand this. Could you be more specific?",
    "Ah! I can only help you with specific topics.",
    "I'm not that smart enough to understand, yet!",
    "Could you be more specific?",
    "Sorry! I didn't understand that.",
  ]
  var random_index = Math.floor(Math.random() * message_options.length)
  var chosen_message = message_options[random_index]

    bot.reply(message, chosen_message)
});

// bot asks "do you have a specifc question"
controller.on(['direct_message','mention','direct_mention'],function(bot,message) {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  },function(err) {
    if (err) { console.log(err) }
    bot.reply(message,'Do you have a specific question for now?');
  });
});

// storage team data
controller.storage.teams.all(function(err,teams) {

  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t  in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function(err, bot) {
        if (err) {
          console.log('Error connecting bot to Slack:',err);
        } else {
          trackBot(bot);
        }
      });
    }
  }

});



//Using attachments
controller.hears(["heaven$"], [ 'direct_message','direct_mention','mention'], function (bot, message) {
  var reply_with_attachments = {
    'username': 'uxbot',
    'text': 'I heard you used `heaven` as a keyword.',
    'attachments': [
      {
        //'fallback': 'To be useful, I need you to invite me in a channel.',
        'title': 'How can I help you?',
        //'text': 'To be useful, I need you to invite me in a channel ',
        'color': '#7CD197'
      }
    ],
    }

  bot.reply(message, reply_with_attachments);
});

/* ====================================
/* Slash Command starts
======================================= */

// add commands 

/* ====================================
/* Slash Command ends 
======================================= */


/* ====================================
/* GSIUXD Slack Community Channel Archives  
======================================= */

// https://getstartedinuxdesign.slack.com/archives
// The following channel IDs won't work for your slack team.
// Just make sure to update the following channels and their IDs before testing for your slack team. 


// #general                         C0L8M4D0V
// #ask_questions                   C0LLE7JL9
// #member_introductions            C0LLE3BNJ
// #interestingstuff                C0LLE9J9X
// #jobs                            C0LLFQD4Y
// #bookmark-and-resource           C0LLQ26NA
// #uxevents                        C0M2W80J1
// #design_feedback                 C0R43MBGS
// #books                           C4K141RLY
// #admins_only                     G0LM7C1BL
// #user_research                   C4NCLSRTJ
// #visual_design                   C4PNLBJJG
// #learning_ux                     C4PNLMNTW
// #wireframe_prototype             C4PNLK4KW
// #usability_testing               C4QCEMMF1
