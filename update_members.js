const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const { request } = require('https');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);

// Github API requires user agent that should be filled with the name of the app
const userAgent = 'org-members-location';
const githubToken = process.env.GITHUB_TOKEN;
const gmapKey = process.env.GMAP_KEY;
const outputFile = path.join(__dirname, 'members.json');

// return promise resolved into parsed json
function jsonReq(url, options = {}, postData) {
  return new Promise((resolve, reject) => {
    const req = request(url, options, res => {
      const { statusCode } = res;

      let error;
      if (statusCode !== 200) {
        error = new Error(`Request Failed.\nStatus Code: ${statusCode}`);
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', chunk => {
        rawData += chunk;
      });
      res.on('end', () => {
        if (error) {
          reject(error);
          res.resume();
          return;
        }

        try {
          const parsedData = JSON.parse(rawData);
          resolve(parsedData);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', e => {
      reject(new Error(`Request Failed.\nError: ${e.message}`));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// make graphql request to github
function githubReq(query) {
  const options = {
    method: 'POST',
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${githubToken}`
    }
  };
  const postData = JSON.stringify({ query });

  return jsonReq('https://api.github.com/graphql', options, postData);
}

function geocodeGmap(address) {
  const query = querystring.stringify({
    address,
    key: gmapKey
  });

  return jsonReq(
    `https://maps.googleapis.com/maps/api/geocode/json?${query}`
  ).then(resp => {
    if (resp.status == 'ZERO_RESULTS') {
      return null;
    }

    if (resp.status != 'OK') {
      throw new Error(`${resp.status}: ${resp.error_message}`);
    }

    const result = resp.results[0];
    const loc = result.geometry.location;
    return { name: result.formatted_address, lat: loc.lat, long: loc.lng };
  });
}
const geocodeGmapCache = {};

// return normalized name and coordinates for an address
function geocode(address) {
  if (!geocodeGmapCache[address]) {
    geocodeGmapCache[address] = geocodeGmap(address);
  }

  return geocodeGmapCache[address];
}

// returns array of members with login, name and text location
function getMembers() {
  // need to handle pagination for bigger orgs
  return githubReq(`query {
        organization(login: "src-d") {
            membersWithRole(first: 100) {
                nodes {
                login
                name
                location
                }
            }
        }
    }`).then(resp => resp.data.organization.membersWithRole.nodes);
}

// parse text location into normalized name and coordinates
function parseLocation(loc) {
  if (!loc) {
    return Promise.resolve(null);
  }

  // people like to put more than 1 location into the field
  // take only the first one in such case
  loc = loc
    .split('/')[0]
    .trim()
    .split('&')[0]
    .trim();

  return geocode(loc);
}

getMembers()
  .then(members =>
    Promise.all(
      members.map(m =>
        parseLocation(m.location).then(location =>
          Object.assign({}, m, { location })
        )
      )
    )
  )
  .then(members => {
    return JSON.stringify(members, null, '  ') + '\n';
  })
  .then(json => writeFile(outputFile, json))
  .then(() => console.info('done'))
  .catch(e => {
    console.error('failed');
    console.error(e);
    process.exit(1);
  });
