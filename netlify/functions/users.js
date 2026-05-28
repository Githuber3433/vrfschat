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

    const users = getUsers();
    const usersList = Object.values(users).map(user => ({
        uid: user.uid,
        username: user.username,
        verified: user.verified,
        avatar: `https://userpic.vrfs.org/avatar/avatar-pics/${user.uid}.png`,
        online: user.online || false,
        lastSeen: user.lastSeen,
        country: user.country || 'Unknown'
    }));

    return {
        statusCode: 200,
        body: JSON.stringify(usersList),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    };
};
