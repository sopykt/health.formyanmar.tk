//This is still work in progress
/*
Please report any bugs to nicomwaks@gmail.com
i have added console.log on line 48 
 */
'use strict'

require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN)
const SERVER_URL = (process.env.SERVER_URL)
const token = (process.env.MESSENGER_PAGE_ACCESS_TOKEN)
//const connect = require('connect')
const serveStatic = require('serve-static')
// load shelljs and chance
const shell = require('shelljs');
const Chance = require('chance');
var chance = new Chance();

// Load ReadLastLines
const readLastLines = require('read-last-lines');

//testing calling custom modules
const mymodule = require('mymodule')
// -> my_module initialized.
mymodule.printA(); 
// -> my_module worked.
mymodule.printB(); 

app.set('port', (process.env.PORT || 2000))

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())

// index
//app.get('/', function (req, res) {
//	res.send('hello world i am a secret bot')
//})

//servestatic for assets
app.use(serveStatic(__dirname + '/public', {
  maxAge: '1d',
  setHeaders: setCustomCacheControl
}))

function setCustomCacheControl (res, path) {
  if (serveStatic.mime.lookup(path) === 'text/html') {
    // Custom Cache-Control for HTML files
    res.setHeader('Cache-Control', 'public, max-age=0')
  }
}

// for facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === VALIDATION_TOKEN) {
		res.send(req.query['hub.challenge'])
	} else {
		res.send('Error, wrong token')
	}
})

app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else if (messagingEvent.account_linking) {
          receivedAccountLink(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL. 
 * 
 */
app.get('/authorize', function(req, res) {
  var accountLinkingToken = req.query.account_linking_token;
  var redirectURI = req.query.redirect_uri;

  // Authorization Code should be generated per user by the developer. This will 
  // be passed to the Account Linking callback.
  var authCode = "1234567890";

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('authorize', {
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
});

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the 'data-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the 
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger' 
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam, 
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  sendTextMessage(senderID, "Authentication successful");
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some 
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've 
 * created. If we receive a message with an attachment (image, video, audio), 
 * then we'll simply confirm that we've received the attachment.
 * 
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  
  

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;
  var buttons = message.buttons;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s", 
      messageId, appId, metadata);
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s",
      messageId, quickReplyPayload);
	switch (quickReplyPayload) {
	  case 'DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY':
		sendTextMessage(senderID, "comedy choosed");
		break;
		
	  case 'Bacteria_PAYLOAD':
		sendCategoriesQuickReply(senderID, "/foodborne/fb_bacteria.PNG");
		break;
		
	  case 'Viruses_PAYLOAD':
		sendCategoriesQuickReply(senderID, "/foodborne/fb_viruses.PNG");
		break;
		
	  case 'Protozoa_PAYLOAD':
		sendCategoriesQuickReply(senderID, "/foodborne/fb_protozoa.PNG");
		break;
		
	  case 'Trematodes_PAYLOAD':
		sendCategoriesQuickReply(senderID, "/foodborne/fb_trematodes.PNG");
		break;
		
	  case 'Cestodes_PAYLOAD':
		sendCategoriesQuickReply(senderID, "/foodborne/fb_cestodes.PNG");
		break;
	  
	  case 'Nematodes_PAYLOAD':
		sendCategoriesQuickReply(senderID, "/foodborne/fb_nematodes.PNG");
		break;
		
	  case 'Natural_Toxins_PAYLOAD':
		sendCategoriesQuickReply(senderID, "/foodborne/fb_natural_toxins.PNG");
		break;
		
	  case 'Chemicals_PAYLOAD':
		sendCategoriesQuickReply(senderID, "/foodborne/fb_chemicals.PNG");
		break;
		
	  case 'Categories_Back_PAYLOAD':
		sendFoodborneQuickReply(senderID);
		break;
		
	  case 'Categories_More_PAYLOAD':
		sendTextMessage(senderID, "For details\, just type an organism or a disease name\. For Example\, \"Aeromonas enteritis\" or \"Aeromonas hydrophila\" \(without \"\"\)");
		break;
		
	  case 'Red_Blood_Tubes':
		sendTextMessage(senderID, "The red bottle is less common – it is used for biochemistry tests requiring serum which might be adversely affected by the separator gel used in the yellow bottle.");
		sendTextMessage(senderID, "Additive: None or contains silica particles which act as clot activators. \nWhat additive does: Clot activator promotes blood clotting with glass or silica particles. \nLaboratory Uses: Serum testing (glucose, cholesterol, triglycerides, HDL, potassium, amylase, alkaline phosphatase, BUN, CK, liver enzymes), blood bank, serology (RH Typing, Antibody screening, Red Cell Phototyping, DAT, RPR, monospot, rheumatoid factor, ANA)");
		break;
		
	  case 'Yellow_Blood_Tubes':
		sendTextMessage(senderID, "Additive: anticoagulant SPS (Sodium Polyanetholsulfonate) & ACD (acid citrate dextrose) \nWhat additive does: Prevents the blood from clotting and stabilizes bacterial growth. \nLaboratory Uses: Blood and bodily fluid cultures (HLA, DNA, Paternity) Tubes with SPS – For Blood and bodily fluid cultures (HLA, DNA, Paternity). The SPS aids in the recovery of microorganisms by slowing down\/ stopping the actions of complement, phagocytes, and certain antibiotics. Tubes with ACD are for cellular studies, HLA typing, paternity testing.");
		break;

	  case 'Light_Blue_Blood_Tubes':
		sendTextMessage(senderID, "The blue bottle is used for haematology tests involving the clotting system, which require inactivated whole blood for analysis.");
		sendTextMessage(senderID, "Additive: Sodium Citrate \nWhat additive does: Binds and remove calcium to prevent blood from clotting \nLaboratory uses: Coagulation (clotting process-P.T) PT (Prothrombin Time – evaluates the extrinsic system of the coagulation cascade & monitors coumadin therapy) APTT/ PTT (Activated Partial Thromboplastin Time – evaluates the intrinsic system of the coagulation cascade & monitors heparin therapy) FDP (Fibrinogen Degradation Products) TT (Thrombin Time) Factor assays");
		break;
		
	  case 'Green_Blood_Tubes':
		sendTextMessage(senderID, "This less commonly used bottle is for biochemistry tests which require heparinised plasma or whole blood for analysis.");
		sendTextMessage(senderID, "Additive: Heparin (Sodium/Lithium/Ammonium) \nWhat additive does: Inhibits thrombin formation to prevent clotting \nLaboratory uses: Chemistry Testing (Plasma determinations in chemistry) : ammonia, carboxyhemoglobin & STAT electrolytes, chromosome screening, insulin, renin and aldosterone");
		break;
		
	  case 'Lavender_Blood_Tubes':
		sendTextMessage(senderID, "These bottles are generally used for haematology tests where whole blood is required for analysis.");
		sendTextMessage(senderID, "Additive: EDTA (Ethylenediaminetetraacetic Acid) \nWhat additive does: Removes calcium preventing clotting of blood \nLaboratory uses: Hematology testing (ESR, CBC w/diff., HgBA1c) blood film for abnormal cells or malaria parasites, reticulocytes, red cell folate, Monospot test for EBV, parathyroid hormone (PTH)");
		break;
		
	  case 'Grey_Blood_Tubes':
		sendTextMessage(senderID, "Additive: Potassium oxalate and Sodium fluoride \nWhat additive does: Sodium fluoride acts as an antiglycolytic agent to ensure that no further glucose breakdown occurs within the sample after it is taken. Potassium oxalate removes calcium and acts as an anticoagulant. \nLaboratory uses: Chemistry testing, especially glucose(sugar) and lactate, Glucose tolerance test (GTT)");
		break;
		
	  case 'Royal_Blue_Blood_Tubes':
		sendTextMessage(senderID, "Additive: Sodium Heparin also Sodium EDTA \nWhat additive does: Inhibits Thrombin formation to prevent \nLaboratory uses: Chemistry trace elements (such as Zinc, Copper, Lead and Mercury), toxicology, and nutritional chemistry testing");
		break;
		
	  case 'Black_Blood_Tubes':
		sendTextMessage(senderID, "Additive: Sodium Citrate \nWhat additive does: Forms calcium salts to remove calcium \nLaboratory uses: paediatric ESR");
		break;	
		
	  case 'Type1_DM_Chart':
		sendTestImageMessage(senderID, "/dm/type1-dm.jpg");
        break;
        
      case 'Type2_DM_Chart':
		sendTestImageMessage(senderID, "/dm/type2-dm.jpg");
        break;
        
      case 'Gross_Motor_Developmental_Milestones':
		sendTestImageMessage(senderID, "/developmental-milestones/gross-motor-milestones2.jpg");
		break;
		
	  case 'Fine_Motor_Developmental_Milestones':
		sendTestImageMessage(senderID, "/developmental-milestones/fine-motor-milestones.jpg");
		break;
		
	  case 'Social_Developmental_Milestones':
		sendTestImageMessage(senderID, "/developmental-milestones/social-milestones.jpg");
		break;
		
	  case 'Language_Developmental_Milestones':
		sendTestImageMessage(senderID, "/developmental-milestones/language-milestones.jpg");
		break;
		
	  case 'Cephalexin_Payload':
		sendTextMessage(senderID, "Therapeutic action \n💊💊💊💊💊💊 \nFirst-generation cephalosporin antibacterial"); 
		sendTextMessage(senderID, "Indications \n🎯🎯🎯🎯🎯 \nSkin infections due to staphylococci and/or streptococci: impetigo, furuncle, erysipelas and superficial cellulitis");
		sendTextMessage(senderID, "Presentation \n💊💊💊💊💊💊 \n250 mg capsule \n125 mg/5 ml powder");
		sendTextMessage(senderID, "Dosage \n💊💊💊💊💊💊 \nNeonate under 7 days: \n50 mg/kg/day in 2 divided doses \nNeonate 7 to 28 days: \n75 mg/kg/day in 3 divided doses \nThe exact dose should be calculated according to the newborn\’s weight\. \nChild 1 month to 12 years: \n25 to 50 mg/kg/day in 2 divided doses \nChild over 12 years and adult: \n2 g/day in 2 divided doses");
		sendCephalexinDoseImageMessage(senderID);
		sendTextMessage(senderID, "Duration \n⏰⏰⏰⏰⏰ \nImpetigo, furuncle: 7 days; \nerysipelas, cellulitis: 7 to 10 days");
		sendTextMessage(senderID, "Contra-indications, adverse effects, precautions \n💣💣💣💣💣 \nDo not administer to patients with allergy to cephalosporin\. \nAdminister with caution to patients with allergy to penicillin \(cross-sensitivity may occur\) and severe renal impairment \(reduce the dose\)\. \nMay cause: gastrointestinal disturbances \(particularly diarrhoea\)\, allergic reactions \(skin eruption\, fever\, pruritus\)\. \nPregnancy: \nno contra-indication \nBreast-feeding: \nno contra-indication");
		sendTextMessage(senderID, "Remarks \n✔✔✔✔✔ \nTake preferably between meals\. \nAlso comes in 250 mg/5 ml powder for oral suspension\. \nStorage\: below 25°C \nFor the oral suspension \(powder or reconstituted suspension\)\: \nfollow manufacturer\’s instructions");
		break;
		
	  case 'Diabetes_Payload':
		sendDiabetesQuickReply(senderID);
		break;
		
	  case 'Test_Tubes_Payload':
		sendBloodTubeGenericMessage(senderID);
		break;
		
	  case 'Milestones_Payload':
		sendMilestonesQuickReply(senderID);
		break;
	}
		//sendTextMessage(senderID, "Quick reply tapped");
    return;
  }

  if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText.toLowerCase()) {
      
      case 'help':
		sendGetStartedQuickReply(senderID);
		break;
      
      case 'cephalexin':
      case 'cefalexin':
		sendTextMessage(senderID, "Therapeutic action \n💊💊💊💊💊💊 \nFirst-generation cephalosporin antibacterial"); 
		sendTextMessage(senderID, "Indications \n🎯🎯🎯🎯🎯 \nSkin infections due to staphylococci and/or streptococci: impetigo, furuncle, erysipelas and superficial cellulitis");
		sendTextMessage(senderID, "Presentation \n💊💊💊💊💊💊 \n250 mg capsule \n125 mg/5 ml powder");
		sendTextMessage(senderID, "Dosage \n💊💊💊💊💊💊 \nNeonate under 7 days: \n50 mg/kg/day in 2 divided doses \nNeonate 7 to 28 days: \n75 mg/kg/day in 3 divided doses \nThe exact dose should be calculated according to the newborn\’s weight\. \nChild 1 month to 12 years: \n25 to 50 mg/kg/day in 2 divided doses \nChild over 12 years and adult: \n2 g/day in 2 divided doses");
		sendCephalexinDoseImageMessage(senderID);
		sendTextMessage(senderID, "Duration \n⏰⏰⏰⏰⏰ \nImpetigo, furuncle: 7 days; \nerysipelas, cellulitis: 7 to 10 days");
		sendTextMessage(senderID, "Contra-indications, adverse effects, precautions \n💣💣💣💣💣 \nDo not administer to patients with allergy to cephalosporin\. \nAdminister with caution to patients with allergy to penicillin \(cross-sensitivity may occur\) and severe renal impairment \(reduce the dose\)\. \nMay cause: gastrointestinal disturbances \(particularly diarrhoea\)\, allergic reactions \(skin eruption\, fever\, pruritus\)\. \nPregnancy: \nno contra-indication \nBreast-feeding: \nno contra-indication");
		sendTextMessage(senderID, "Remarks \n✔✔✔✔✔ \nTake preferably between meals\. \nAlso comes in 250 mg/5 ml powder for oral suspension\. \nStorage\: below 25°C \nFor the oral suspension \(powder or reconstituted suspension\)\: \nfollow manufacturer\’s instructions");
		break;

	  case 'ygh-opd':
	  case 'ygh opd':
		sendTestImageMessage(senderID, "/yghopd/ygh-opd.jpg");
		break;		

	  case 'rabies vaccine':
		sendTestImageMessage(senderID, "/vaccine/rabies-vaccine-myanmar.jpg");
		break;

	  case 'honey':
		sendTestAudioMessage(senderID, "/recording/Apr-24-1-25-PM-Honey-MWD.mp3");
		break;

	  case 'essay':
		sendTestAudioMessage(senderID, "/recording/Apr-25-1-09-PM-Ess-MWD.mp3");
		break;

	  case 'urinate':
		sendTestAudioMessage(senderID, "/recording/Apr-25-1-21-PM-Urinate-MWD.mp3");
		break;

	  case 'vomitting':
		sendTestAudioMessage(senderID, "/recording/Apr-26-4-01-PM-vomitting-MWD.mp3");
		break;

	  case 'ngapeeyay':
	  case 'ငပိရည်':
	  case 'ငပိရည္':
	  case 'ငါးပိရည်':
	  case 'ငါးပိရည္':
		sendTestAudioMessage(senderID, "/recording/May-8-11-06-AM-nga-pee-yay-MWD.mp3");
        break;
		
	  case 'myanmar health centers':
		sendTestImageMessage(senderID, "/myanmar-health-centers/mm-health-centers.jpg");
		sendTextMessage(senderID, "For details map view of each states\, please type given names\- \nayeyarwadi\,\nbago\,\nchin\,\nkachin\,\nkayar\,\nkayin\,\nmagwe\,\nmandalay\,\nmon\,\nnaypyitaw\,\nrakhine\,\nsagaing\,\nshan\,\ntanintharyi\,\nyangon\. \n\(either capital or small\)");
		break;

	  case 'ayeyarwadi':
		sendTestImageMessage(senderID, "/myanmar-health-centers/ayeyarwadi.jpg");
		break;
		
	  case 'bago':
		sendTestImageMessage(senderID, "/myanmar-health-centers/bago.jpg");
		break;

	  case 'chin':
		sendTestImageMessage(senderID, "/myanmar-health-centers/chin.jpg");
		break;
		
	  case 'kachin':
		sendTestImageMessage(senderID, "/myanmar-health-centers/kachin.jpg");
		break;	
		
	  case 'kayar':
		sendTestImageMessage(senderID, "/myanmar-health-centers/kayar.jpg");
		break;
		
	  case 'kayin':
		sendTestImageMessage(senderID, "/myanmar-health-centers/kayin.jpg");
		break;
		
	  case 'magwe':
		sendTestImageMessage(senderID, "/myanmar-health-centers/magwe.jpg");
		break;
		
	  case 'mandalay':
		sendTestImageMessage(senderID, "/myanmar-health-centers/mandalay.jpg");
		break;
		
	  case 'mon':
		sendTestImageMessage(senderID, "/myanmar-health-centers/mon.jpg");
		break;
		
	  case 'naypyitaw':
		sendTestImageMessage(senderID, "/myanmar-health-centers/naypyitaw.jpg");
		break;	
		
	  case 'rakhine':
		sendTestImageMessage(senderID, "/myanmar-health-centers/rakhine.jpg");
		break;
		
	  case 'sagaing':
		sendTestImageMessage(senderID, "/myanmar-health-centers/sagaing.jpg");
		break;	
		
	  case 'shan':
		sendTestImageMessage(senderID, "/myanmar-health-centers/shan.jpg");
		break;
		
	  case 'tanintharyi':
		sendTestImageMessage(senderID, "/myanmar-health-centers/tanintharyi.jpg");
		break;	
		
	  case 'yangon':
		sendTestImageMessage(senderID, "/myanmar-health-centers/yangon.jpg");
		break;
	  case 'foodborne diseases':
		sendFoodborneQuickReply(senderID);
		break;
		
	  case 'aeromonas enteritis':
	  case 'aeromonas':
	  case 'aeromonas hydrophila':
		sendTestImageMessage(senderID, "/foodborne/fb_aeromonas_enteritis.PNG");
		break;
		
	  case 'amoebiasis':
	  case 'amoebic dysentery':
	  case 'entamoeba histolytica':
		sendTestImageMessage(senderID, "/foodborne/fb_amoebiasis.png");
		break;
		
	  case 'anisakiasis':
	  case 'anisakis':
	  case 'anisakis spp':
		sendTestImageMessage(senderID, "/foodborne/fb_anisakiasis.png");
		break;
		
	  case 'ascariasis':
	  case 'ascaris lumbricoides':
		sendTestImageMessage(senderID, "/foodborne/fb_ascariasis.png");
		break;
		
	  case 'bacillus cereus':
		sendTestImageMessage(senderID, "/foodborne/fb_bacillus_cereus.png");
		break;
		
	  case 'botulism':
		sendTestImageMessage(senderID, "/foodborne/fb_botulism.png");
		break;
		
	  case 'brucellosis':
		sendTestImageMessage(senderID, "/foodborne/fb_brucellosis.png");
		break;
		
	  case 'campylobacteriosis':
		sendTestImageMessage(senderID, "/foodborne/fb_campylobacteriosis.png");
		break;
		
	  case 'cholera':
		sendTestImageMessage(senderID, "/foodborne/fb_cholera.png");
		break;
		
	  case 'clonorchiasis':
		sendTestImageMessage(senderID, "/foodborne/fb_clonorchiasis.png");
		break;
		
	  case 'clostridium perfringens':
		sendTestImageMessage(senderID, "/foodborne/fb_clostridium_perfringens.png");
		break;
		
	  case 'cryptosporidiosis':
		sendTestImageMessage(senderID, "/foodborne/fb_cryptosporidiosis.png");
		break;
		
	  case 'escherichia coli':
		sendTestImageMessage(senderID, "/foodborne/fb_escherichia_coli-1.png");
		sendTestImageMessage(senderID, "/foodborne/fb_escherichia_coli-2.png");
		break;
		
	  case 'fascioliasis':
		sendTestImageMessage(senderID, "/foodborne/fb_fascioliasis.png");
		break;
		
	  case 'giardiasis':
		sendTestImageMessage(senderID, "/foodborne/fb_giardiasis.png");
		break;
		
	  case 'hepatitis a':
		sendTestImageMessage(senderID, "/foodborne/fb_hepatitis_a.png");
		break;
		
	  case 'listeriosis':
		sendTestImageMessage(senderID, "/foodborne/fb_listeriosis.png");
		break;
		
	  case 'opisthorchiasis':
		sendTestImageMessage(senderID, "/foodborne/fb_opisthorchiasis.png");
		break;
		
	  case 'paragonimiasis':
		sendTestImageMessage(senderID, "/foodborne/fb_paragonimiasis.png");
		break;
		
	  case 'poliomyelitis':
		sendTestImageMessage(senderID, "/foodborne/fb_poliomyelitis.png");
		break;
		
	  case 'salmonellosis':
		sendTestImageMessage(senderID, "/foodborne/fb_salmonellosis.png");
		break;
		
	  case 'shigellosis':
		sendTestImageMessage(senderID, "/foodborne/fb_shigellosis.png");
		break;
		
	  case 'staphylococcus aureus':
		sendTestImageMessage(senderID, "/foodborne/fb_staphylococcus_aureus.png");
		break;
		
	  case 'taeniasis':
		sendTestImageMessage(senderID, "/foodborne/fb_taeniasis.png");
		break;
		
	  case 'toxoplasmosis':
		sendTestImageMessage(senderID, "/foodborne/fb_toxoplasmosis.png");
		break;
		
	  case 'trichinellosis':
		sendTestImageMessage(senderID, "/foodborne/fb_trichinellosis.png");
		break;
		
	  case 'typhoid':
		sendTestImageMessage(senderID, "/foodborne/fb_typhoid.png");
		break;
		
	  case 'vibrio parahaemolyticus':
		sendTestImageMessage(senderID, "/foodborne/fb_vibrio_parahaemolyticus.png");
		break;
		
	  case 'vibrio vulnificus':
		sendTestImageMessage(senderID, "/foodborne/fb_vibrio_vulnificus.png");
		break;
		
	  case 'viral gastroenteritis':
		sendTestImageMessage(senderID, "/foodborne/fb_viral_gastroenteritis.png");
		break;
		
	  case 'yersiniosis':
		sendTestImageMessage(senderID, "/foodborne/fb_yersiniosis.png");
		break;
		
	  case 'cefixime':
		sendTextMessage(senderID, "Therapeutic action \n💊💊💊💊💊💊 \nThird-generation cephalosporin antibacterial");
		sendTextMessage(senderID, "Indications \n🎯🎯🎯🎯🎯 \nTyphoid fever in children \nAcute cystitis in girls over 2 years\, pregnant women and lactating women \nAcute pyelonephritis in adults \nCervicitis and urethritis due to Neisseria gonorrhoeae \(in combination with a treatment for chlamydia\)");
		sendTextMessage(senderID, "Presentation \n💊💊💊💊💊💊 \n200 mg tablet \n100 mg/5 ml powder for oral suspension\, to be reconstituted with filtered water");
		sendTextMessage(senderID, "Dosage \n💊💊💊💊💊💊 \nTyphoid fever in children \nChild over 3 months\: \n20 mg/kg/day in 2 divided doses \nAcute cystitis in girls over 2 years \n8 mg/kg once daily \nAcute cystitis in pregnant and lactating women\, acute pyelonephritis in adult \n400 mg/day in 2 divided doses \nCervicitis and urethritis due to Neisseria gonorrhoeae \nChild: 8 mg/kg as a single dose \nAdult: 400 mg as a single dose");
		sendTextMessage(senderID, "Duration \n⏰⏰⏰⏰⏰ \nTyphoid fever: 7 days; \nacute cystitis: 3 days for girls and 5 days for adults; \nacute pyelonephritis: 10 to 14 days");
		sendTextMessage(senderID, "Contra-indications, adverse effects, precautions \n💣💣💣💣💣 \nDo not administer to patients with allergy to cephalosporins\. \nAdminister with caution to penicillin-allergic patients \(cross-sensitivity may occur\) and in patients with severe renal impairment \(reduce dosage\)\. \nMay cause: gastrointestinal disturbances \(especially diarrhoea\)\, headache\, dizziness\, allergic reactions \(rash\, pruritus\, fever\)\. In the event of allergic reaction\, stop treatment immediately\. \nPregnancy: no contra-indication \nBreast-feeding: no contra-indication");
		sendTextMessage(senderID, "Remarks \n✔✔✔✔✔ \nAlso comes in 400 mg capsules \nStorage: below 25°C \nFor the oral suspension \(powder or reconstituted suspension\): follow manufacturer\’s instructions\.");
		break;
		
	  case 'chlorphenamine':
	  case 'chlorpheniramine':
	  case 'burmeton':
		sendTextMessage(senderID, "Therapeutic action \n💊💊💊💊💊💊 \nSedating antihistamine");
		sendTextMessage(senderID, "Indications \n🎯🎯🎯🎯🎯 \nSymptomatic treatment of minor allergic reactions \(contact dermatitis\, seasonal allergy\, allergy to drugs\, food\, etc\.\)");
		sendTextMessage(senderID, "Presentation \n💊💊💊💊💊💊 \n4 mg tablet \nAlso comes in 2 mg/5 ml oral solution");
		sendTextMessage(senderID, "Dosage \n💊💊💊💊💊💊 \nChild from 1 to 2 years: 1 mg 2 times daily \nChild from 2 to 6 years: 1 mg 4 to 6 times daily \(max\. 6 mg/day\) \nChild from 6 to 12 years: 2 mg 4 to 6 times daily \(max\. 12 mg/day\) \nChild over 12 years and adult: 4 mg 4 to 6 times daily \(max\. 24 mg/day\)");
		sendBurmetonDoseImageMessage(senderID);
		sendTextMessage(senderID, "Duration \n⏰⏰⏰⏰⏰ \nAccording to clinical response: as short as possible");
		sendTextMessage(senderID, "Contra-indications, adverse effects, precautions \n💣💣💣💣💣 \nAdminister with caution and monitor use in patients with prostate disorders or closed-angle glaucoma\, patients \> 60 years and children \(risk of agitation\, excitability\)\. \nMay cause: drowsiness \(caution when driving/operating machinery\)\, anticholinergic effects \(dry mouth\, blurred vision\, constipation\, tachycardia\, disorders of micturition\)\, headache\, tremor\, allergic reactions\. \nMonitor combination with CNS depressants \(opioid analgesics\, antipsychotics\, sedatives\, antidepressants\, etc\.\)\. \nAvoid alcohol during treatment\. \nPregnancy: no contra-indication: NO PROLONGED TREATMENT \nBreast-feeding: no contra-indication: monitor the child for excessive somnolence\.");
		sendTextMessage(senderID, "Remarks \n✔✔✔✔✔ \nChlorphenamine is less sedating than promethazine. \nDexchlorpheniramine has the same indications: \n• child 1 to 2 years: 0.25 mg 2 to 3 times daily \n• child 2 to 6 years: 0.5 mg 2 to 3 times daily \n• child 6 to 12 years: 1 mg 3 to 4 times daily \n• child over 12 years and adult: 2 mg 3 to 4 times daily \nStorage: below 25°C");
		break;
		
      case 'test button':
        sendTestButtonMessage(senderID);
        break;
        
      case 'test image':
        sendTestImageMessage(senderID, "/assets/rift.png");
        break;
        
      case 'amiodarone':
        sendTestImageMessage(senderID, "/idd/amiodarone.jpg");
        break;
      
	  case 'dobutamine':
        sendTestImageMessage(senderID, "/idd/dobutamine.jpg");
        break;
        
      case 'dopamine':
        sendTestImageMessage(senderID, "/idd/dopamine.jpg");
        break;
        
      case 'fentanyl':
        sendTestImageMessage(senderID, "/idd/fentanyl.jpg");
        break;
        
      case 'heparin':
        sendTestImageMessage(senderID, "/idd/heparin.jpg");
        break;
      
      case 'insulin':
        sendTestImageMessage(senderID, "/idd/insulin.jpg");
        break;
      
      case 'labetalol':
        sendTestImageMessage(senderID, "/idd/labetalol.jpg");
        break;
      
      case 'lasix':
        sendTestImageMessage(senderID, "/idd/lasix.jpg");
        break;
        
      case 'midazolam':
        sendTestImageMessage(senderID, "/idd/midazolam.jpg");
        break;
      
      case 'nitroglycerine':
        sendTestImageMessage(senderID, "/idd/nitroglycerine.jpg");
        break;
      
      case 'octreotide':
        sendTestImageMessage(senderID, "/idd/octreotide.jpg");
        break;
      
      case 'phenytoin':
        sendTestImageMessage(senderID, "/idd/phenytoin.jpg");
        break;
      
      case 'propofol':
        sendTestImageMessage(senderID, "/idd/propofol.jpg");
        break;
        
      case 'vasopressin':
        sendTestImageMessage(senderID, "/idd/vasopressin.jpg");
        break;
      
	  case 'hi':
	  case 'hello':
		sendTextMessage(senderID, "Hi. Nice to meet you. This is Test Bot");
		break;
		
	  case 'link':
		sendTextMessage(senderID, "http://www.mobilemonk.tv/conversational-commerce-rise-of-the-chatbots");
		break;
		
	  case 'မင်္ဂလာပါ':
		sendTextMessage(senderID, "မင်္ဂလာပါ ကျွန်တော်ကတော့ စမ်းသပ်နေသော စက်ရုပ်ပါ");
		break;
		
	  case 'မဂၤလာပါ':
		sendTextMessage(senderID, "မဂၤလာပါ က်ြန္ေတာ္ကေတာ့ စမ္းသပ္ေနေသာ စက္ရုပ္ပါ");
		break;
		
	  case 'photo':
	  case 'image':
        sendImageMessage(senderID);
        break;

	  case 'gif':
        sendGifMessage(senderID);
        break;

	  case 'audio':
	  case 'sound':
        sendAudioMessage(senderID);
        break;

	  case 'video':
        sendVideoMessage(senderID, "/assets/allofus480.mov");
        break;
        
      case 'tracheostomy':
		sendVideoMessage(senderID, "/vid/tracheostomy.mp4");
		break;

	  case 'com1':
		sendVideoMessage(senderID, "/vid/basic-com.mkv");
		break;

	  case 'file':
        sendFileMessage(senderID);
        break;

	  case 'button':
        sendButtonMessage(senderID);
        break;

      case 'generic':
        sendGenericMessage(senderID);
        break;
        
      case 'blood collection tubes':
      case 'blood tubes':
      case 'blood collection tube':
      case 'blood tube':
      case 'test tubes':
      case 'test tube':
        sendBloodTubeGenericMessage(senderID);
        break;
        
	  case 'test generic':
		sendTestGenericMessage(senderID);
		break;

      case 'receipt':
        sendReceiptMessage(senderID);
        break;

      case 'quick reply':
        sendQuickReply(senderID);
        break;
        
      case 'milestones':
      case 'developmental milestones':
		//sendTestImageMessage(senderID, "/developmental-milestones/gross-motor-milestones1.jpg");
		sendMilestonesQuickReply(senderID);
		break;
        
      case 'diabetes':
		sendDiabetesQuickReply(senderID);
		break;

      case 'read receipt':
        sendReadReceipt(senderID);
        break;        

      case 'typing on':
        sendTypingOn(senderID);
        break;        

      case 'typing off':
        sendTypingOff(senderID);
        break; 
        
   //   case 'my profile':
	//	getUserProfile();
	//	sendTextMessage(senderID, userFirstName);
	//	break;
		
      case 'account linking':
        sendAccountLinking(senderID);
        break;

      default:
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
	var messageAttachmenturl = "\"" + message.attachments[0].payload.url + "\"";
	var my_random_string = chance.first();
	shell.exec('wget --accept .jpg,.jpeg --cookies=on -p ' + messageAttachmenturl + ' -O ../mynodeapp/public/' + my_random_string + '.jpg', function(code, stdout, stderr) {
  		console.log('Exit code:', code);
  		console.log('Program output:', stdout);
		readLastLines.read('/home/soepaing/.pm2/logs/devbot-error-5.log', 5)
    			.then((lines) => sendTextMessage(senderID, lines));
		//var wgetjson = JSON.parse(stderr);
  		//console.log('Program stderr:', wgetjson);
		//sendTextMessage(senderID, stdout);
		//sendTextMessage(senderID, stderr);
	});

	//console.log(messageAttachmenturl);
	
  }
}



// get user profile testing

/*function sendUserNameMessage(recipientId) {
	var firstname = getUserProfile();
	
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: firstname,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };
  
  callSendAPI(messageData);
}
*/
 /*function getUserProfile() {
	
  request({
    uri: 'https://graph.facebook.com/v2.6/me?fields=first_name,last_name,profile_pic,locale,timezone,gender',
    qs: { access_token: token },
    method: 'GET',
    json: true

  }, function (error, response, body) {
  var fbinfo = new Array(body.first_name, body.last_name, body.profile_pic); 
   var userFirstName = fbinfo[0];
   return userFirstName;
  }
  ); 
}
 */
/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s", 
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);
    
    // test payload for test button
    if (payload) {
	  
	 switch (payload) {
	  case 'testing_postback_button_was_clicked':
		sendTextMessage(senderID, "testing sucessful");
		break;
		
	  case 'GET_STARTED_PAYLOAD':
		sendGetStartedQuickReply(senderID);
		break;
		
	  default:
        sendTextMessage(senderID, "Postback called");
	}
		}

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 */
function receivedAccountLink(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var status = event.account_linking.status;
  var authCode = event.account_linking.authorization_code;

  console.log("Received account link event with for user %d with status %s " +
    "and auth code %s ", senderID, status, authCode);
}

/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/rift.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

// this is test convo box function
function sendConvoBox (recipientId) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: "Thanks for purchase, This item will deliver to your location as soon as possible. \nWhat is your name?",
			metadata: "DEVELOPER_DEFINED_METADATA"
		}
		
	};
	
	callSendAPI(messageData);
	
}

/*
 * Send cephalexin dose png image 
 *
 */
function sendCephalexinDoseImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/cephalexin_dose.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send burmeton dose png image 
 *
 */
function sendBurmetonDoseImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/burmeton_dose.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: SERVER_URL + "/assets/instagram_logo.gif"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send audio using the Send API.
 *
 */
function sendAudioMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "audio",
        payload: {
          url: SERVER_URL + "/assets/sample.mp3"
        }
      }
    }
  };

  callSendAPI(messageData);
}

// this is test sendaudio function
function sendTestAudioMessage(recipientId, audiourl)	{
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment:{
				type:"audio",
				payload:{
					url:SERVER_URL+audiourl
				}
			}
		}
	};
	
	callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 * /assets/allofus480.mov
 */
function sendVideoMessage(recipientId, videourl) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "video",
        payload: {
          url: SERVER_URL + videourl
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a file using the Send API.
 *
 */
function sendFileMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "file",
        payload: {
          url: SERVER_URL + "/assets/test.txt"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

// this is test sendimage function
function sendTestImageMessage(recipientId, imageurl)	{
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			attachment:{
				type:"image",
				payload:{
					url:SERVER_URL+imageurl
				}
			}
		}
	};
	
	callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons:[{
            type: "web_url",
            url: "https://www.oculus.com/en-us/rift/",
            title: "Open Web URL"
          }, {
            type: "postback",
            title: "Trigger Postback",
            payload: "DEVELOPER_DEFINED_PAYLOAD"
          }, {
            type: "phone_number",
            title: "Call Phone Number",
            payload: "+16505551234"
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * button message testing
 *
 */
function sendTestButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is tested button message",
          buttons:[{
            type: "web_url",
            url: "https://www.google.com/",
            title: "Google it"
          }, {
            type: "postback",
            title: "What is button message?",
            payload: "testing_postback_button_was_clicked"
          }, {
            type: "phone_number",
            title: "Call Phone Number",
            payload: "+959972973223"
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: SERVER_URL + "/assets/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: SERVER_URL + "/assets/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

//sendBloodTubeGenericMessage

function sendBloodTubeGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Common Blood Collection Tube",
            subtitle: "their additives and laboratory uses.",
            item_url: "http://www.medcyclopedia.net/common-blood-collection-tubes-their-additives-and-laboratory-uses/",               
            image_url: SERVER_URL + "/bt/blood-tubes.jpg",
            buttons: [{
              type: "web_url",
              url: "http://www.medcyclopedia.net/common-blood-collection-tubes-their-additives-and-laboratory-uses/",
              title: "View on Web"
            }],
          }]
        }
      },
      quick_replies: [
        {
          "content_type":"text",
          "title":"Red",
          "payload":"Red_Blood_Tubes"
        },
        {
          "content_type":"text",
          "title":"Yellow",
          "payload":"Yellow_Blood_Tubes"
        },
        {
          "content_type":"text",
          "title":"Light Blue",
          "payload":"Light_Blue_Blood_Tubes"
        },
        {
          "content_type":"text",
          "title":"Green",
          "payload":"Green_Blood_Tubes"
        },
        {
          "content_type":"text",
          "title":"Lavender",
          "payload":"Lavender_Blood_Tubes"
        },
        {
          "content_type":"text",
          "title":"Grey",
          "payload":"Grey_Blood_Tubes"
        },
        {
          "content_type":"text",
          "title":"Royal Blue",
          "payload":"Royal_Blue_Blood_Tubes"
        },
        {
          "content_type":"text",
          "title":"Black",
          "payload":"Black_Blood_Tubes"
        }
      ]
    }
  };  

  callSendAPI(messageData);
}

//sendMyanmarHealthCentersQuickReply
/*
function sendMyanmarHealthCentersQuickReply(recipientId, imageurl) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment:{
				type:"image",
				payload:{
					url:SERVER_URL+imageurl
				}
			},
      quick_replies: [
        {
          "content_type":"text",
          "title":"AyeYarWadi",
          "payload":"AyeYarWadiPayload"
        },
        {
          "content_type":"text",
          "title":"Bago",
          "payload":"BagoPayload"
        },
        {
          "content_type":"text",
          "title":"Chin",
          "payload":"ChinPayload"
        },
        {
          "content_type":"text",
          "title":"Kachin",
          "payload":"KachinPayload"
        },
        {
          "content_type":"text",
          "title":"Kayar",
          "payload":"KayarPayload"
        },
        {
          "content_type":"text",
          "title":"Kayin",
          "payload":"KayinPayload"
        },
        {
          "content_type":"text",
          "title":"Magwe",
          "payload":"MagwePayload"
        },
        {
          "content_type":"text",
          "title":"Mandalay",
          "payload":"MandalayPayload"
        },
        {
          "content_type":"text",
          "title":"Mon",
          "payload":"MonPayload"
        },
        {
          "content_type":"text",
          "title":"NayPyiTaw",
          "payload":"NayPyiTawPayload"
        },
        {
          "content_type":"text",
          "title":"Rakhine",
          "payload":"RakhinePayload"
        },
        {
          "content_type":"text",
          "title":"Sagaing",
          "payload":"SagaingPayload"
        },
        {
          "content_type":"text",
          "title":"Shan",
          "payload":"ShanPayload"
        },
        {
          "content_type":"text",
          "title":"TaNinTharYi",
          "payload":"TaNinTharYiPayload"
        },
        {
          "content_type":"text",
          "title":"Yangon",
          "payload":"YangonPayload"
        }
      ]
    }
  };  

  callSendAPI(messageData);
}
*/

/*
 * test generic message for webview
 *
 */
function sendTestGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: SERVER_URL + "/assets/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://docs.google.com/forms/d/e/1FAIpQLSe3S4kOw__1esQ835RWhlPDD03uOhxpUKEdOE4h5Zh9ZKNw0Q/viewform?usp=pp_url&entry.1991652553&entry.560259158&entry.1928389408&entry.221518448=rift-001",
              title: "Buy Now",
              webview_height_ratio:"compact"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: SERVER_URL + "/assets/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random()*1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",        
          timestamp: "1428444852", 
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: SERVER_URL + "/assets/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: SERVER_URL + "/assets/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "What's your favorite movie genre?",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Action",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
        },
        {
          "content_type":"text",
          "title":"Comedy",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY"
        },
        {
          "content_type":"text",
          "title":"Drama",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_DRAMA"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

//foodborne diseases quickReply
function sendFoodborneQuickReply(recipientId) {
	var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Choose from following categories..",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Bacteria",
          "payload":"Bacteria_PAYLOAD"
        },
        {
          "content_type":"text",
          "title":"Viruses",
          "payload":"Viruses_PAYLOAD"
        },
        {
          "content_type":"text",
          "title":"Protozoa",
          "payload":"Protozoa_PAYLOAD"
        },
		{
          "content_type":"text",
          "title":"Trematodes",
          "payload":"Trematodes_PAYLOAD"
        },
		{
          "content_type":"text",
          "title":"Cestodes",
          "payload":"Cestodes_PAYLOAD"
        },
		{
          "content_type":"text",
          "title":"Nematodes",
          "payload":"Nematodes_PAYLOAD"
        },
		{
          "content_type":"text",
          "title":"Natural toxins",
          "payload":"Natural_Toxins_PAYLOAD"
        },
		{
          "content_type":"text",
          "title":"Chemicals",
          "payload":"Chemicals_PAYLOAD"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

//quick reply for each categories
function sendCategoriesQuickReply(recipientId, imageurl) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment:{
				type:"image",
				payload:{
					url:SERVER_URL+imageurl
				}
			},
      quick_replies: [
        {
          "content_type":"text",
          "title":"Back",
          "payload":"Categories_Back_PAYLOAD"
        },
        {
          "content_type":"text",
          "title":"More",
          "payload":"Categories_More_PAYLOAD"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

//get started quick reply
function sendGetStartedQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Welcome to developbot\! \nYou can now ask Bot like \"cephalexin\"\, \"Propofol\"\, \"Diabetes\"\, \"Hi\"\, \"Test tubes\"\, \"Milestones\" \nAny time you need this help\, just text \"Help\" to me\.",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Cephalexin",
          "payload":"Cephalexin_Payload"
        },
        {
          "content_type":"text",
          "title":"Diabetes",
          "payload":"Diabetes_Payload"
        },
        {
          "content_type":"text",
          "title":"Test tubes",
          "payload":"Test_Tubes_Payload"
        },
        {
          "content_type":"text",
          "title":"Milestones",
          "payload":"Milestones_Payload"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

//developmental milestones quick reply
function sendMilestonesQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Which one?",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Gross motor",
          "payload":"Gross_Motor_Developmental_Milestones"
        },
        {
          "content_type":"text",
          "title":"Fine motor",
          "payload":"Fine_Motor_Developmental_Milestones"
        },
        {
          "content_type":"text",
          "title":"Social & Adaptive",
          "payload":"Social_Developmental_Milestones"
        },
        {
          "content_type":"text",
          "title":"Language",
          "payload":"Language_Developmental_Milestones"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

//sendDiabetesQuickReply
function sendDiabetesQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "What type of Diabetes",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Type 1",
          "payload":"Type1_DM_Chart"
        },
        {
          "content_type":"text",
          "title":"Type 2",
          "payload":"Type2_DM_Chart"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {
  console.log("Sending a read receipt to mark message as seen");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {
  console.log("Turning typing indicator off");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_off"
  };

  callSendAPI(messageData);
}

/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Welcome. Link your account.",
          buttons:[{
            type: "account_link",
            url: SERVER_URL + "/authorize"
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: token },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });  
}

//post persistent menu
/*function setPersistentMenu()	{
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messenger_profile',
		qs: {access_token: token},
		method: 'POST',
		json: {
  "persistent_menu":[
    {
      "locale":"default",
      "composer_input_disabled":true,
      "call_to_actions":[
        {
          "title":"My Account",
          "type":"nested",
          "call_to_actions":[
            {
              "title":"Pay Bill",
              "type":"postback",
              "payload":"PAYBILL_PAYLOAD"
            },
            {
              "title":"History",
              "type":"postback",
              "payload":"HISTORY_PAYLOAD"
            },
            {
              "title":"Contact Info",
              "type":"postback",
              "payload":"CONTACT_INFO_PAYLOAD"
            }
          ]
        },
        {
          "type":"web_url",
          "title":"Latest News",
          "url":"http://petershats.parseapp.com/hat-news",
          "webview_height_ratio":"full"
        }
      ]
    },
    {
      "locale":"zh_CN",
      "composer_input_disabled":false
    }
  ]
}
		},	function (error, response, body)	{
			var resultjson = body.result;
	//		if (error)	{
	//			console.error("error setting persistent menu");
	//			} else {
	//				console.log("persistent menu successfully set with %s result", resultjson);
	//				}
			
			if (!error && response.statusCode == 200)	{
				console.log("persistent menu successfully set with %s result", resultjson);
				} else {
					console.error("error setting persistent menu");
					}
			}
	);
	}
	
setPersistentMenu();
*/

//get started button
/*function GetStartedButton()	{
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messenger_profile',
		qs: {access_token: token},
		method: 'POST',
		json: { 
  "get_started":{
    "payload":"GET_STARTED_PAYLOAD"
  }
}
		},	function (error, response, body)	{
			var resultjson = body.result;
		//	if (error)	{
		//		console.error("error setting persistent menu");
		//		} else {
		//			console.log("persistent menu successfully set with %s result", resultjson);
		//			}
			
			if (!error && response.statusCode == 200)	{
				console.log("get started button successfully set with %s result", resultjson);
				} else {
					console.error("error setting get started button");
					}
			}
	);
	}

GetStartedButton();
*/

// spin spin sugar
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})
