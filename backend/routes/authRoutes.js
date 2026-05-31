const express = require("express");

const router = express.Router();

const db = require("../config/db");

const PDFDocument = require("pdfkit");

const fs = require("fs");

const path = require("path");

/* ================= LOGIN ================= */

router.post("/login", (req, res) => {

    const { name, password } = req.body;

    const sql =
    "SELECT * FROM staff WHERE name=? AND password=?";

    db.query(sql, [name, password], (err, result) => {

        if(err){
            return res.json(err);
        }

        if(result.length > 0){

            res.json({
                success:true,
                user:result[0]
            });

        }else{

            res.json({
                success:false,
                message:"Invalid Login"
            });

        }

    });

});

/* ================= CHECK IN ================= */

router.post("/checkin", (req, res) => {

    const { staff_id } = req.body;

    const sql = `
    SELECT *
    FROM schedules
    WHERE staff_id = ?
    AND work_date = CURDATE()
    `;

    db.query(sql, [staff_id], (err, result) => {

        if(err){
            return res.json(err);
        }

        if(result.length === 0){

            return res.json({
                success:false,
                message:"No Schedule Today"
            });

        }

        const currentTime =
        new Date().toLocaleTimeString(
            "en-GB",
            {
                timeZone: "Asia/Tokyo",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }
        );

        const startTime =
        result[0].start_time.slice(0,5);

        const [cH, cM] =
        currentTime.split(":").map(Number);

        const [sH, sM] =
        startTime.split(":").map(Number);

        const currentMinutes =
        cH * 60 + cM;

        const startMinutes =
        sH * 60 + sM;

        console.log("Current Time:", currentTime);
        console.log("Start Time:", startTime);
        console.log("Current Minutes:", currentMinutes);
        console.log("Start Minutes:", startMinutes);

        /* Allow 30 minutes early */

        if(currentMinutes < startMinutes - 30){

            return res.json({
                success:false,
                message:"Too Early For Check In"
            });

        }

        const insertSql = `
        INSERT INTO attendance
        (staff_id, check_in)
        VALUES (?, NOW())
        `;

        db.query(
            insertSql,
            [staff_id],
            (err, result) => {

                if(err){
                    return res.json(err);
                }

                db.query(
                    "INSERT INTO activity_log (staff_id, action) VALUES (?, ?)",
                    [staff_id, "Check In"]
                );

                res.json({
                    success:true,
                    message:"Checked In"
                });

            }
        );

    });

});

/* ================= BREAK IN ================= */

router.post("/breakin", (req, res) => {

    const { staff_id } = req.body;

    const sql = `
    INSERT INTO breaks
    (staff_id, break_in)
    VALUES (?, NOW())
    `;

    db.query(sql, [staff_id], (err, result) => {

        if(err){
            return res.json(err);
        }
db.query(
    "INSERT INTO activity_log (staff_id, action) VALUES (?, ?)",
    [staff_id, "Break In"]
);
        res.json({
            success:true,
            message:"Break Started"
        });

    });

});

/* ================= BREAK OUT ================= */

router.post("/breakout", (req, res) => {

    const { staff_id } = req.body;

    const sql = `
    UPDATE breaks
    SET
    break_out = NOW(),
    total_break_minutes =
    TIMESTAMPDIFF(
        MINUTE,
        break_in,
        NOW()
    )
    WHERE staff_id = ?
    AND break_out IS NULL
    `;

    db.query(sql, [staff_id], (err, result) => {

        if(err){
            return res.json(err);
        }
db.query(
    "INSERT INTO activity_log (staff_id, action) VALUES (?, ?)",
    [staff_id, "Break Out"]
);
        res.json({
            success:true,
            message:"Break Ended"
        });

    });

});

/* ================= CHECK OUT ================= */

router.post("/checkout", (req, res) => {

    const { staff_id } = req.body;

    const breakSql = `
    SELECT
    IFNULL(
        SUM(total_break_minutes),
        0
    ) AS totalBreak
    FROM breaks
    WHERE staff_id = ?
    AND DATE(break_in) = CURDATE()
    `;

    db.query(
        breakSql,
        [staff_id],
        (err, breakResult) => {

            if(err){
                return res.json(err);
            }

            const totalBreak =
            breakResult[0].totalBreak;

            const sql = `
            UPDATE attendance
            SET
            check_out = NOW(),
            total_minutes =
            TIMESTAMPDIFF(
                MINUTE,
                check_in,
                NOW()
            ) - ?
            WHERE staff_id = ?
            AND check_out IS NULL
            `;

            db.query(
                sql,
                [totalBreak, staff_id],
                (err, result) => {

                    if(err){
                        return res.json(err);
                    }
db.query(
    "INSERT INTO activity_log (staff_id, action) VALUES (?, ?)",
    [staff_id, "Check Out"]
);
                    res.json({
                        success:true,
                        message:"Checked Out"
                    });

                }
            );

        }
    );

});

/* ================= ATTENDANCE ================= */

router.get("/attendance", (req, res) => {

    const sql = `
    SELECT
    attendance.id,
    staff.name,
    attendance.check_in,
    attendance.check_out,
    attendance.total_minutes
    FROM attendance
    JOIN staff
    ON attendance.staff_id = staff.id
    ORDER BY attendance.id DESC
    `;

    db.query(sql, (err, result) => {

        if(err){
            return res.json(err);
        }

        res.json(result);

    });

});

/* ================= ADD STAFF ================= */

router.post("/addstaff", (req, res) => {

    const {
        name,
        password,
        role
    } = req.body;

    const sql = `
    INSERT INTO staff
    (name, password, role)
    VALUES (?, ?, ?)
    `;

    db.query(
        sql,
        [name, password, role],
        (err, result) => {

            if(err){
                return res.json(err);
            }

            res.json({
                success:true,
                message:"Staff Added"
            });

        }
    );

});

/* ================= STAFF LIST ================= */

router.get("/stafflist", (req, res) => {

    db.query(
        "SELECT id, name FROM staff",
        (err, result) => {

            if(err){
                return res.json(err);
            }

            res.json(result);

        }
    );

});

/* ================= MONTHLY HOURS ================= */

router.get("/monthlyhours", (req, res) => {

    const sql = `
    SELECT
    staff.name,
    IFNULL(
        SUM(attendance.total_minutes),
        0
    ) AS total_minutes
    FROM attendance
    JOIN staff
    ON attendance.staff_id = staff.id
    GROUP BY staff.name
    `;

    db.query(sql, (err, result) => {

        if(err){
            return res.json(err);
        }

        res.json(result);

    });

});

/* ================= ADD SCHEDULE ================= */

router.post("/addschedules", (req, res) => {

    const {
        staff_id,
        work_date,
        start_time,
        end_time
    } = req.body;

    const sql = `
    INSERT INTO schedules
    (staff_id, work_date, start_time, end_time)
    VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            staff_id,
            work_date,
            start_time,
            end_time
        ],
        (err, result) => {

            if(err){
                return res.json(err);
            }

            res.json({
                success:true,
                message:"Schedule Added"
            });

        }
    );

});

/* ================= WEEK SCHEDULE ================= */

router.get("/week-schedules", (req, res) => {

    const { role, staff_id } = req.query;

    let sql = `
    SELECT schedules.*, staff.name
    FROM schedules
    JOIN staff
    ON schedules.staff_id = staff.id
    `;

    let params = [];

    if(role === "staff"){

        sql += `
        WHERE schedules.staff_id = ?
        `;

        params.push(staff_id);

    }

    sql += `
    ORDER BY work_date ASC
    `;

    db.query(sql, params, (err, result) => {

        if(err){
            return res.json(err);
        }

        res.json(result);

    });

});

/* ================= UPDATE SCHEDULE ================= */

router.post("/update-schedule", (req, res) => {

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

/* ================= DELETE SCHEDULE ================= */

router.delete("/delete-schedule/:id", (req, res) => {

    const { id } = req.params;

    const sql = `
    DELETE FROM schedules
    WHERE id = ?
    `;

    db.query(sql, [id], (err, result) => {

        if(err){
            return res.json(err);
        }

        res.json({
            success:true,
            message:"Schedule Deleted"
        });

    });

});

/* ================= PDF REPORT ================= */

router.get(
"/monthlyreport/:staffId/:month",
(req, res) => {

    const staffId = req.params.staffId;

    const month = req.params.month;

    const sql = `
    SELECT
    staff.name,
    IFNULL(
        SUM(attendance.total_minutes),
        0
    ) AS total_minutes
    FROM attendance
    JOIN staff
    ON attendance.staff_id = staff.id
    WHERE attendance.staff_id = ?
    AND MONTH(attendance.check_in) = ?
    GROUP BY staff.name
    `;

    db.query(
        sql,
        [staffId, month],
        (err, result) => {

            if(err){
                return res.json(err);
            }

            if(result.length === 0){
                return res.send("No Data");
            }

            const item = result[0];

            const totalHours =
            (item.total_minutes / 60).toFixed(2);

            const doc = new PDFDocument();

            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                "inline; filename=report.pdf"
            );

            doc.pipe(res);

            doc
            .fontSize(22)
            .text("Monthly Work Report");

            doc.moveDown();

            doc
            .fontSize(16)
            .text(`Staff Name: ${item.name}`);

            doc.moveDown();

            doc
            .fontSize(18)
            .text(`Total Hours: ${totalHours} hrs`);

            doc.end();

        }
    );

});
/* ================= DELETE STAFF ================= */

router.delete(
"/deletestaff/:id",
(req, res) => {

    const staffId = req.params.id;

    /* delete attendance */

    db.query(
    "DELETE FROM attendance WHERE staff_id = ?",
    [staffId],
    (err) => {

        if(err){
            return res.json(err);
        }

        /* delete breaks */

        db.query(
        "DELETE FROM breaks WHERE staff_id = ?",
        [staffId],
        (err) => {

            if(err){
                return res.json(err);
            }

            /* delete schedules */

            db.query(
            "DELETE FROM schedules WHERE staff_id = ?",
            [staffId],
            (err) => {

                if(err){
                    return res.json(err);
                }

                /* delete staff account */

                db.query(
                "DELETE FROM staff WHERE id = ?",
                [staffId],
                (err) => {

                    if(err){
                        return res.json(err);
                    }

                    res.json({
                        success:true,
                        message:"Staff Deleted"
                    });

                });

            });

        });

    });

});
/* ================= ACTIVITY LOG ================= */

router.get("/activitylog", (req, res) => {

    const sql = `
    SELECT
    activity_log.id,
    staff.name,
    activity_log.action,
    activity_log.action_time
    FROM activity_log
    JOIN staff
    ON activity_log.staff_id = staff.id
    ORDER BY activity_log.action_time DESC
    `;

    db.query(sql, (err, result) => {

        if(err){
            return res.json(err);
        }

        res.json(result);

    });

});
module.exports = router;