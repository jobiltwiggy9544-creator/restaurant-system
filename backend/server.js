require("dotenv").config();

const express = require("express");

const mysql = require("mysql2");

const cors = require("cors");

const path = require("path");

const authRoutes =
require("./routes/authRoutes");

const app = express();

/* MIDDLEWARE */

app.use(cors());

app.use(express.json());

/* PDF REPORTS FOLDER */

app.use(
    "/reports",
    express.static(
        path.join(__dirname, "reports")
    )
);

/* ROUTES */

app.use("/", authRoutes);

/* DATABASE */

const db = require("./config/db");

db.connect(err => {

    if(err){

        console.log(err);

    }else{

        console.log("MySQL Connected");

    }

});

/* STAFF LIST */

app.get("/stafflist", (req, res) => {

    db.query(
        "SELECT id, name FROM staff",
        (err, result) => {

            if(err){
                return res.status(500).json(err);
            }

            res.json(result);

        }
    );

});

/* WEEK SCHEDULE */

app.get("/week-schedules", (req, res) => {

    const { role, staff_id } = req.query;

    const startOfWeek = new Date();

    startOfWeek.setDate(
        startOfWeek.getDate()
        - startOfWeek.getDay()
    );

    const endOfWeek = new Date();

    endOfWeek.setDate(
        startOfWeek.getDate() + 6
    );

    let sql;

    let params = [];

    if(role === "admin"){

        sql = `
        SELECT schedules.*, staff.name
        FROM schedules
        JOIN staff
        ON schedules.staff_id = staff.id
        WHERE work_date BETWEEN ? AND ?
        ORDER BY work_date
        `;

        params = [
            startOfWeek,
            endOfWeek
        ];

    }else{

        sql = `
        SELECT schedules.*, staff.name
        FROM schedules
        JOIN staff
        ON schedules.staff_id = staff.id
        WHERE schedules.staff_id = ?
        AND work_date BETWEEN ? AND ?
        ORDER BY work_date
        `;

        params = [
            staff_id,
            startOfWeek,
            endOfWeek
        ];

    }

    db.query(
        sql,
        params,
        (err, result) => {

            if(err){
                return res.json(err);
            }

            res.json(result);

        }
    );

});

/* UPDATE SCHEDULE */

app.post(
"/update-schedule",
(req, res) => {

    const {
        id,
        field,
        value
    } = req.body;

    const sql = `
    UPDATE schedules
    SET ${field} = ?
    WHERE id = ?
    `;

    db.query(
        sql,
        [value, id],
        (err, result) => {

            if(err){
                return res.json(err);
            }

            res.json({
                success:true
            });

        }
    );

});

/* DELETE SCHEDULE */

app.delete(
"/delete-schedule/:id",
(req, res) => {

    const sql = `
    DELETE FROM schedules
    WHERE id = ?
    `;

    db.query(
        sql,
        [req.params.id],
        (err, result) => {

            if(err){
                return res.json(err);
            }

            res.json({
                success:true,
                message:"Schedule Deleted"
            });

        }
    );

});

/* START SERVER */

app.listen(3000, () => {

    console.log(
    "Server running on port 3000"
    );

});
