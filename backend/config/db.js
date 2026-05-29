const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Jobil@9544",
    database: "restaurant_system"
});

connection.connect((err) => {

    if (err) {
        console.log("Database Error");
        console.log(err);
    } else {
        console.log("MySQL Connected");
    }

});

module.exports = connection;