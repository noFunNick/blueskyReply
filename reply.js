
import pkg from '@atproto/api';
const { BskyAgent, RichText } = pkg;
var fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import fs from 'fs';
//var apiKey = "AIzaSyDsxhEVOwm1e7eFNiPE3f8zsMmL9YbRsts";
const agent = new BskyAgent({ service: "https://bsky.social" });
// var config = require('./config')
import  config  from './config.js';
import { Jetstream } from "@skyware/jetstream";
import { request } from 'https';
import WebSocket from "ws"
const jetstream = new Jetstream({
    ws: WebSocket
});
var apiKey = config.apikey
var login = config.login
var password = config.password
var sendPost = async (text, unit8Obj, cid, did, uri, altText) => {
    const richText = new RichText({ text });
    try{
        await agent.login({
            identifier: login,
            password: password,
          });
        }
     catch(e){
console.log("problem logging in")
console.log(e)
    }
    try{
        var post = {
            images: [],
            $type: "app.bsky.embed.images",
        }
            const upl = await agent.uploadBlob(unit8Obj, {encoding: "image/jpg"})
 
                post.images.push({image: upl["data"]["blob"], alt:altText})
                console.log(post)   
      
        setTimeout(function(){console.log(post)
             agent.post({
                reply: {
                    root: {
                        uri: "at://" + did + "/app.bsky.feed.post/" + uri,
                        cid: cid
                    },
                    parent: {
                        uri: "at://" + did + "/app.bsky.feed.post/" + uri,
                        cid: cid
                    }},
                text: richText.text,
                facets: richText.facets,
                embed: post
              });
        }, 5000)
     

    }
    
    catch(e){
        console.log(e)
    }
    finally{
        console.log('complete')
    }
  }
  var returnBuffer = async function(base64){
    var bufferValue =  Buffer.from(base64,"base64");
    return bufferValue
   }
   var returnUint8 = async function(buffer){
    var uint8 =  new Uint8Array(buffer);
    return uint8
   }
var getImg = async (urlString, searchTerms, replyCID, replyDID, replyRev, text) => {
    var result = await fetch(urlString);
    var json = await result.json();
    console.log(json);
    if(json.candidates.length == 0){
        sendPost('Sorry, there were no results for that location.', null, replyCID, replyDID, replyRev, text);
        return;
    }
    var placeId = json.candidates[0].place_id;
    var deets = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?fields=name%2Crating%2Cphotos&place_id=${placeId}&key=${apiKey}`);
    var detailsJson = await deets.json();
    console.log(detailsJson);
    if (detailsJson.result.hasOwnProperty('photos') == false){
        sendPost('Sorry, there were no google place photos associated with this place.', null, replyCID, replyDID, replyRev, text);
        return;
    }
    if(detailsJson.result.photos.length ==0){
        sendPost('Sorry, there were no google place photos associated with this place.', null, replyCID, replyDID, replyRev, text);
        return;
    }
    var images = []
    var photos = detailsJson.result.photos;
    var randomNumber = Math.floor(Math.random() * photos.length);
    var photoReference = photos[randomNumber].photo_reference;
    console.log(photoReference);
    const photoResponse = await fetch(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=2000&photoreference=${photoReference}&key=${apiKey}`);
    const photoStream = fs.createWriteStream(`./replyBot.jpg`);

    photoResponse.body.pipe(photoStream);

    photoStream.on('finish', async () => {
        var base64 = fs.readFileSync(`./replyBot.jpg`, 'base64');
        var buffer = await returnBuffer(base64);
        var uint8 = await returnUint8(buffer);
        var size = uint8.length;
        console.log(size);
        if(size > 976000){
            sendPost(`The image is too large to upload.`, null, replyCID, replyDID, replyRev, text);
            return;
        }
        sendPost(`Here is a picture of ${searchTerms} for you. Have a good day!`, uint8, replyCID, replyDID, replyRev, text);
    });

    photoStream.on('error', (err) => {
        console.error('Error writing photo to file:', err);
    });
}
jetstream.onCreate("app.bsky.feed.post", (event) => {
    if(event.commit.record.text.toLowerCase().includes('//location')){
        var text = event.commit.record.text.toLowerCase();
        var splitText = text.split('//location');
        var termsAfter = splitText[1];
        var url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?fields=formatted_address%2Cname%2Cplace_id%2Cphotos%2Cgeometry&input=${termsAfter}&inputtype=textquery&key=${apiKey}`;
        getImg(url, termsAfter, event.commit.cid, event.did, event.commit.rkey, text);
    }

});

jetstream.start()

