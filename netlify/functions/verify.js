const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const USERS_DB = path.join(__dirname, '../../users.json');

function getUsers() {
    if (!fs.existsSync(USERS_DB)) {
        fs.writeFileSync(USERS_DB, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(USERS_DB));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2));
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    const { expectedName, uid } = JSON.parse(event.body);

    if (!uid) {
        return { statusCode: 401, body: JSON.stringify({ error: "Not logged in" }) };
    }

    const users = getUsers();
    const user = users[uid];

    if (!user) {
        return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
    }

    if (user.verified) {
        return { statusCode: 200, body: JSON.stringify({ success: true, alreadyVerified: true }) };
    }

    try {
        const vrfsRes = await fetch(
            `https://api.vrfs.gg/webhooks/v1/get_username.php?uid=${uid}`
        );

        if (!vrfsRes.ok) {
            return { statusCode: 500, body: JSON.stringify({ error: "VRFS API error" }) };
        }

        const username = (await vrfsRes.text()).trim();

        if (username === expectedName) {
            users[uid].verified = true;
            users[uid].verifiedAt = new Date().toISOString();
            saveUsers(users);
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, username }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: false, currentUsername: username }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        }
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
    }
};
