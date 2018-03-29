const bluebird = require('bluebird');
const axios = require('axios');
const cheerio = require('cheerio');
const graph = require('fbgraph');
const { LastFmNode } = require('lastfm');
const tumblr = require('tumblr.js');
const GitHub = require('@octokit/rest');
const Twit = require('twit');
const stripe = require('stripe')(process.env.STRIPE_SKEY);
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const Linkedin = require('node-linkedin')(process.env.LINKEDIN_ID, process.env.LINKEDIN_SECRET, process.env.LINKEDIN_CALLBACK_URL);
const clockwork = require('clockwork')({ key: process.env.CLOCKWORK_KEY });
const paypal = require('paypal-rest-sdk');
const lob = require('lob')(process.env.LOB_KEY);
const ig = bluebird.promisifyAll(require('instagram-node').instagram());
const foursquare = require('node-foursquare')({
  secrets: {
    clientId: process.env.FOURSQUARE_ID,
    clientSecret: process.env.FOURSQUARE_SECRET,
    redirectUrl: process.env.FOURSQUARE_REDIRECT_URL
  },
  foursquare: {
    mode: 'foursquare',
    version: 20140806,
  }
});

foursquare.Venues = bluebird.promisifyAll(foursquare.Venues);
foursquare.Users = bluebird.promisifyAll(foursquare.Users);

/**
 * GET /api
 * List of API examples.
 */
exports.getApi = (req, res) => res.render('api/index', {
  title: 'API Examples'
});

/**
 * GET /api/foursquare
 * Foursquare API example.
 */
exports.getFoursquare = async (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'foursquare');
  try {
    const trendingVenues = await foursquare.Venues.getTrendingAsync('40.7222756', '-74.0022724', { limit: 50 }, token.accessToken);
    const venueDetail = await foursquare.Venues.getVenueAsync('49da74aef964a5208b5e1fe3', token.accessToken);
    const userCheckins = await foursquare.Users.getCheckinsAsync('self', null, token.accessToken);
    return res.render('api/foursquare', {
      title: 'Foursquare API',
      trendingVenues,
      venueDetail,
      userCheckins
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/tumblr
 * Tumblr API example.
 */
exports.getTumblr = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'tumblr');
  const client = tumblr.createClient({
    consumer_key: process.env.TUMBLR_KEY,
    consumer_secret: process.env.TUMBLR_SECRET,
    token: token.accessToken,
    token_secret: token.tokenSecret
  });
  client.posts('mmosdotcom.tumblr.com', { type: 'photo' }, (err, data) => {
    if (err) { return next(err); }
    return res.render('api/tumblr', {
      title: 'Tumblr API',
      blog: data.blog,
      photoset: data.posts[0].photos
    });
  });
};

/**
 * GET /api/facebook
 * Facebook API example.
 */
exports.getFacebook = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'facebook');
  graph.setAccessToken(token.accessToken);
  graph.get(`${req.user.facebook}?fields=id,name,email,first_name,last_name,gender,link,locale,timezone`, (err, profile) => {
    if (err) { return next(err); }
    return res.render('api/facebook', {
      title: 'Facebook API',
      profile
    });
  });
};

/**
 * GET /api/scraping
 * Web scraping example using Cheerio library.
 */
exports.getScraping = async (req, res, next) => {
  try {
    const { data: body } = await axios.get('https://news.ycombinator.com/');
    const $ = cheerio.load(body);
    const links = [];
    $('.title a[href^="http"], a[href^="https"]').each((index, element) => {
      links.push($(element));
    });
    return res.render('api/scraping', {
      title: 'Web Scraping',
      links
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/github
 * GitHub API Example.
 */
exports.getGithub = (req, res, next) => {
  const github = new GitHub();
  github.repos.get({ owner: 'sahat', repo: 'hackathon-starter' }, (err, repo) => {
    if (err) { return next(err); }
    return res.render('api/github', {
      title: 'GitHub API',
      repo: repo.data
    });
  });
};

/**
 * GET /api/aviary
 * Aviary image processing example.
 */
exports.getAviary = (req, res) => res.render('api/aviary', {
  title: 'Aviary API'
});

/**
 * GET /api/nyt
 * New York Times API example.
 */
exports.getNewYorkTimes = async (req, res, next) => {
  const params = {
    'list-name': 'young-adult',
    'api-key': process.env.NYT_KEY
  };
  try {
    const { status, data } = await axios({
      method: 'get',
      url: 'http://api.nytimes.com/svc/books/v2/lists',
      params
    });
    if (status === 403) {
      return next(new Error('Invalid New York Times API Key'));
    }
    return res.render('api/nyt', {
      title: 'New York Times API',
      books: data.results
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/lastfm
 * Last.fm API example.
 */
exports.getLastfm = async (req, res, next) => {
  const lastfm = new LastFmNode({
    api_key: process.env.LASTFM_KEY,
    secret: process.env.LASTFM_SECRET
  });
  let artistInfo = () =>
    new Promise((resolve, reject) => {
      lastfm.request('artist.getInfo', {
        artist: 'Roniit',
        handlers: {
          success: resolve,
          error: reject
        }
      });
    });
  const artistTopTracks = () =>
    new Promise((resolve, reject) => {
      lastfm.request('artist.getTopTracks', {
        artist: 'Roniit',
        handlers: {
          success: ({ toptracks }) => {
            resolve(toptracks.track.slice(0, 10));
          },
          error: reject
        }
      });
    });
  const artistTopAlbums = () =>
    new Promise((resolve, reject) => {
      lastfm.request('artist.getTopAlbums', {
        artist: 'Roniit',
        handlers: {
          success: ({ topalbums }) => {
            resolve(topalbums.album.slice(0, 3));
          },
          error: reject
        }
      });
    });
  try {
    ({ artist: artistInfo } = await artistInfo());
    const artist = {
      name: artistInfo.name,
      image: artistInfo.image.slice(-1)[0]['#text'],
      tags: artistInfo.tags.tag,
      bio: artistInfo.bio.summary,
      stats: artistInfo.stats,
      similar: artistInfo.similar.artist,
      topAlbums: await artistTopAlbums(),
      topTracks: await artistTopTracks()
    };
    return res.render('api/lastfm', {
      title: 'Last.fm API',
      artist
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/twitter
 * Twitter API example.
 */
exports.getTwitter = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'twitter');
  const T = new Twit({
    consumer_key: process.env.TWITTER_KEY,
    consumer_secret: process.env.TWITTER_SECRET,
    access_token: token.accessToken,
    access_token_secret: token.tokenSecret
  });
  T.get('search/tweets', { q: 'nodejs since:2013-01-01', geocode: '40.71448,-74.00598,5mi', count: 10 }, (err, reply) => {
    if (err) { return next(err); }
    return res.render('api/twitter', {
      title: 'Twitter API',
      tweets: reply.statuses
    });
  });
};

/**
 * POST /api/twitter
 * Post a tweet.
 */
exports.postTwitter = (req, res, next) => {
  req.assert('tweet', 'Tweet cannot be empty').notEmpty();

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/api/twitter');
  }

  const token = req.user.tokens.find(token => token.kind === 'twitter');
  const T = new Twit({
    consumer_key: process.env.TWITTER_KEY,
    consumer_secret: process.env.TWITTER_SECRET,
    access_token: token.accessToken,
    access_token_secret: token.tokenSecret
  });
  T.post('statuses/update', { status: req.body.tweet }, (err) => {
    if (err) { return next(err); }
    req.flash('success', { msg: 'Your tweet has been posted.' });
    return res.redirect('/api/twitter');
  });
};

/**
 * GET /api/steam
 * Steam API example.
 */
exports.getSteam = async (req, res, next) => {
  const steamId = req.user.steam;
  const params = { l: 'english', steamid: steamId, key: process.env.STEAM_KEY };

  const getPlayerAchievements = async () => {
    // get the list of the recently played games, pick the most recent one and get its achievements
    let { status, data } = await axios({
      url: 'http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/',
      params
    });

    if (status === 401) {
      throw Error('Missing or Invalid Steam API Key');
    }

    if (data.response.total_count > 0) {
      params.appid = data.response.games[0].appid;
      ({ status, data } = await axios({
        url: 'http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/',
        params
      }));
      if (status === 401) {
        throw Error('Missing or Invalid Steam API Key');
      }
      return data.response;
    }
  };

  const getPlayerSummaries = async () => {
    params.steamids = steamId;
    const { status, data } = await axios({
      url: 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/',
      params
    });
    if (status === 401) {
      throw Error('Missing or Invalid Steam API Key');
    }
    return data.response;
  };

  const getOwnedGames = async () => {
    params.include_appinfo = 1;
    params.include_played_free_games = 1;
    const { status, data } = await axios({
      url: 'http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/',
      params
    });
    if (status === 401) {
      throw Error('Missing or Invalid Steam API Key');
    }
    return data.response;
  };

  try {
    const playerAchievements = await getPlayerAchievements();
    const { players } = await getPlayerSummaries();
    const ownedGames = await getOwnedGames();
    return res.render('api/steam', {
      title: 'Steam Web API',
      ownedGames,
      playerStats: playerAchievements ? playerAchievements.playerstats : null,
      playerSummary: players[0]
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/stripe
 * Stripe API example.
 */
exports.getStripe = (req, res) => {
  res.render('api/stripe', {
    title: 'Stripe API',
    publishableKey: process.env.STRIPE_PKEY
  });
};

/**
 * POST /api/stripe
 * Make a payment.
 */
exports.postStripe = (req, res) => {
  const { stripeToken, stripeEmail } = req.body;
  stripe.charges.create({
    amount: 395,
    currency: 'usd',
    source: stripeToken,
    description: stripeEmail
  }, (err) => {
    if (err && err.type === 'StripeCardError') {
      req.flash('errors', { msg: 'Your card has been declined.' });
      return res.redirect('/api/stripe');
    }
    req.flash('success', { msg: 'Your card has been successfully charged.' });
    res.redirect('/api/stripe');
  });
};

/**
 * GET /api/twilio
 * Twilio API example.
 */
exports.getTwilio = (req, res) => {
  res.render('api/twilio', {
    title: 'Twilio API'
  });
};

/**
 * POST /api/twilio
 * Send a text message using Twilio.
 */
exports.postTwilio = (req, res, next) => {
  req.assert('number', 'Phone number is required.').notEmpty();
  req.assert('message', 'Message cannot be blank.').notEmpty();

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/api/twilio');
  }

  const message = {
    to: req.body.number,
    from: '+13472235148',
    body: req.body.message
  };
  twilio.sendMessage(message, (err, responseData) => {
    if (err) { return next(err.message); }
    req.flash('success', { msg: `Text sent to ${responseData.to}.` });
    res.redirect('/api/twilio');
  });
};

/**
 * GET /api/clockwork
 * Clockwork SMS API example.
 */
exports.getClockwork = (req, res) => {
  res.render('api/clockwork', {
    title: 'Clockwork SMS API'
  });
};

/**
 * POST /api/clockwork
 * Send a text message using Clockwork SMS
 */
exports.postClockwork = (req, res, next) => {
  const message = {
    To: req.body.telephone,
    From: 'Hackathon',
    Content: 'Hello from the Hackathon Starter'
  };
  clockwork.sendSms(message, (err, responseData) => {
    if (err) { return next(err.errDesc); }
    req.flash('success', { msg: `Text sent to ${responseData.responses[0].to}` });
    res.redirect('/api/clockwork');
  });
};

/**
 * GET /api/linkedin
 * LinkedIn API example.
 */
exports.getLinkedin = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'linkedin');
  const linkedin = Linkedin.init(token.accessToken);
  linkedin.people.me((err, $in) => {
    if (err) { return next(err); }
    res.render('api/linkedin', {
      title: 'LinkedIn API',
      profile: $in
    });
  });
};

/**
 * GET /api/instagram
 * Instagram API example.
 */
exports.getInstagram = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'instagram');
  ig.use({ client_id: process.env.INSTAGRAM_ID, client_secret: process.env.INSTAGRAM_SECRET });
  ig.use({ access_token: token.accessToken });
  Promise.all([
    ig.user_searchAsync('richellemead'),
    ig.userAsync('175948269'),
    ig.media_popularAsync(),
    ig.user_self_media_recentAsync()
  ])
    .then(([searchByUsername, searchByUserId, popularImages, myRecentMedia]) => {
      res.render('api/instagram', {
        title: 'Instagram API',
        usernames: searchByUsername,
        userById: searchByUserId,
        popularImages,
        myRecentMedia
      });
    })
    .catch(next);
};

/**
 * GET /api/paypal
 * PayPal SDK example.
 */
exports.getPayPal = (req, res, next) => {
  paypal.configure({
    mode: 'sandbox',
    client_id: process.env.PAYPAL_ID,
    client_secret: process.env.PAYPAL_SECRET
  });

  const paymentDetails = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal'
    },
    redirect_urls: {
      return_url: process.env.PAYPAL_RETURN_URL,
      cancel_url: process.env.PAYPAL_CANCEL_URL
    },
    transactions: [{
      description: 'Hackathon Starter',
      amount: {
        currency: 'USD',
        total: '1.99'
      }
    }]
  };

  paypal.payment.create(paymentDetails, (err, payment) => {
    if (err) { return next(err); }
    const { links, id } = payment;
    req.session.paymentId = id;
    for (let i = 0; i < links.length; i++) {
      if (links[i].rel === 'approval_url') {
        res.render('api/paypal', {
          approvalUrl: links[i].href
        });
      }
    }
  });
};

/**
 * GET /api/paypal/success
 * PayPal SDK example.
 */
exports.getPayPalSuccess = (req, res) => {
  const { paymentId } = req.session;
  const paymentDetails = { payer_id: req.query.PayerID };
  paypal.payment.execute(paymentId, paymentDetails, (err) => {
    res.render('api/paypal', {
      result: true,
      success: !err
    });
  });
};

/**
 * GET /api/paypal/cancel
 * PayPal SDK example.
 */
exports.getPayPalCancel = (req, res) => {
  req.session.paymentId = null;
  return res.render('api/paypal', {
    result: true,
    canceled: true
  });
};

/**
 * GET /api/lob
 * Lob API example.
 */
exports.getLob = (req, res, next) => {
  lob.routes.list({ zip_codes: ['10007'] }, (err, routes) => {
    if (err) { return next(err); }
    return res.render('api/lob', {
      title: 'Lob API',
      routes: routes.data[0].routes
    });
  });
};

/**
 * GET /api/upload
 * File Upload API example.
 */

exports.getFileUpload = (req, res) => res.render('api/upload', {
  title: 'File Upload'
});

exports.postFileUpload = (req, res) => {
  req.flash('success', { msg: 'File was uploaded successfully.' });
  return res.redirect('/api/upload');
};

/**
 * GET /api/pinterest
 * Pinterest API example.
 */
exports.getPinterest = async (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'pinterest');
  console.log(token);
  try {
    const { data: boards } = await axios.get({
      url: 'https://api.pinterest.com/v1/me/boards/',
      params: {
        access_token: token.accessToken
      }
    });
    return res.render('api/pinterest', {
      title: 'Pinterest API',
      boards: boards.data
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/pinterest
 * Create a pin.
 */
exports.postPinterest = async (req, res, next) => {
  req.assert('board', 'Board is required.').notEmpty();
  req.assert('note', 'Note cannot be blank.').notEmpty();
  req.assert('image_url', 'Image URL cannot be blank.').notEmpty();

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/api/pinterest');
  }

  const token = req.user.tokens.find(token => token.kind === 'pinterest');
  const formData = {
    board: req.body.board,
    note: req.body.note,
    link: req.body.link,
    image_url: req.body.image_url
  };

  try {
    const { status, data } = await axios.post('https://api.pinterest.com/v1/pins/', {
      params: {
        access_token: token.accessToken
      },
      data: formData
    });
    if (status !== 201) {
      req.flash('errors', { msg: data.message });
      return res.redirect('/api/pinterest');
    }
    req.flash('success', { msg: 'Pin created' });
    return res.redirect('/api/pinterest');
  } catch (err) {
    return next(err);
  }
};

exports.getGoogleMaps = (req, res) => res.render('api/google-maps', {
  title: 'Google Maps API',
  google_map_api_key: process.env.GOOGLE_MAP_API_KEY
});
