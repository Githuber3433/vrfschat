const fs = require('fs');
const path = require('path');

const USERS_DB = path.join(__dirname, '../../users.json');

function getUsers() {
    if (!fs.existsSync(USERS_DB)) {
        fs.writeFileSync(USERS_DB, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(USERS_DB));
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    const { uid } = event.queryStringParameters;

    if (!uid) {
        return { statusCode: 401, body: JSON.stringify({ error: "Not logged in" }) };
    }

    const users = getUsers();
    const user = users[uid];

    if (!user) {
        return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            uid: user.uid,
            username: user.username,
            verified: user.verified,
            country: user.country || 'Unknown',
            online: user.online || false
        }),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    };
};
