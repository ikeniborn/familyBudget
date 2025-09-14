--
-- PostgreSQL database dump
--

\restrict 61RYjrAYP2sqixejbgPg9KyfDXNS8y4KqVtUYmvMjseEodizrguP9nIXC20Ftml

-- Dumped from database version 13.22
-- Dumped by pg_dump version 13.22

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: nomenclaturetype; Type: TYPE; Schema: public; Owner: budget
--

CREATE TYPE public.nomenclaturetype AS ENUM (
    'INCOME',
    'EXPENSE'
);


ALTER TYPE public.nomenclaturetype OWNER TO budget;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO budget;

--
-- Name: t_d_cost_center; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_cost_center (
    cost_center_id integer NOT NULL,
    cost_center_name character varying NOT NULL,
    is_active boolean DEFAULT true,
    user_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.t_d_cost_center OWNER TO budget;

--
-- Name: t_d_cost_center_cost_center_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_d_cost_center_cost_center_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_d_cost_center_cost_center_id_seq OWNER TO budget;

--
-- Name: t_d_cost_center_cost_center_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_d_cost_center_cost_center_id_seq OWNED BY public.t_d_cost_center.cost_center_id;


--
-- Name: t_d_financial_center; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_financial_center (
    financial_center_id integer NOT NULL,
    financial_center_name character varying NOT NULL,
    is_active boolean DEFAULT true,
    user_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.t_d_financial_center OWNER TO budget;

--
-- Name: t_d_financial_center_financial_center_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_d_financial_center_financial_center_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_d_financial_center_financial_center_id_seq OWNER TO budget;

--
-- Name: t_d_financial_center_financial_center_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_d_financial_center_financial_center_id_seq OWNED BY public.t_d_financial_center.financial_center_id;


--
-- Name: t_d_nomenclature; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_nomenclature (
    nomenclature_id integer NOT NULL,
    nomenclature_name character varying NOT NULL,
    account_name character varying NOT NULL,
    bill_name character varying NOT NULL,
    operation_name character varying NOT NULL,
    is_budget boolean NOT NULL,
    is_fact boolean NOT NULL,
    nomenclature_type character varying(20) DEFAULT 'EXPENSE'::character varying,
    is_active boolean DEFAULT true,
    user_id integer,
    parent_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.t_d_nomenclature OWNER TO budget;

--
-- Name: t_d_nomenclature_nomenclature_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_d_nomenclature_nomenclature_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_d_nomenclature_nomenclature_id_seq OWNER TO budget;

--
-- Name: t_d_nomenclature_nomenclature_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_d_nomenclature_nomenclature_id_seq OWNED BY public.t_d_nomenclature.nomenclature_id;


--
-- Name: t_d_period; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_period (
    period_id integer NOT NULL,
    period_dt timestamp without time zone NOT NULL,
    period_ru_name character varying NOT NULL,
    period_start_date timestamp without time zone,
    period_end_date timestamp without time zone,
    user_id integer
);


ALTER TABLE public.t_d_period OWNER TO budget;

--
-- Name: t_d_period_period_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_d_period_period_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_d_period_period_id_seq OWNER TO budget;

--
-- Name: t_d_period_period_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_d_period_period_id_seq OWNED BY public.t_d_period.period_id;


--
-- Name: t_d_product; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_product (
    product_id integer NOT NULL,
    product_name character varying(255) NOT NULL,
    category_name character varying(100),
    unit_measure character varying(50),
    barcode character varying(50),
    description character varying,
    is_active boolean NOT NULL,
    created_dttm timestamp with time zone DEFAULT now(),
    updated_dttm timestamp with time zone DEFAULT now()
);


ALTER TABLE public.t_d_product OWNER TO budget;

--
-- Name: t_d_product_product_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_d_product_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_d_product_product_id_seq OWNER TO budget;

--
-- Name: t_d_product_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_d_product_product_id_seq OWNED BY public.t_d_product.product_id;


--
-- Name: t_d_row_type; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_row_type (
    row_type_id integer NOT NULL,
    row_type_name character varying NOT NULL
);


ALTER TABLE public.t_d_row_type OWNER TO budget;

--
-- Name: t_d_row_type_row_type_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_d_row_type_row_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_d_row_type_row_type_id_seq OWNER TO budget;

--
-- Name: t_d_row_type_row_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_d_row_type_row_type_id_seq OWNED BY public.t_d_row_type.row_type_id;


--
-- Name: t_d_sharing; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_sharing (
    sharing_id integer NOT NULL,
    owner_user_id integer NOT NULL,
    shared_with_user_id integer NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id integer,
    permission_type character varying(20) DEFAULT 'read'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_dttm timestamp with time zone DEFAULT now() NOT NULL,
    updated_dttm timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_t_d_sharing_different_users CHECK ((owner_user_id <> shared_with_user_id)),
    CONSTRAINT ck_t_d_sharing_permission_type CHECK (((permission_type)::text = ANY ((ARRAY['read'::character varying, 'write'::character varying])::text[]))),
    CONSTRAINT ck_t_d_sharing_resource_type CHECK (((resource_type)::text = ANY ((ARRAY['nomenclature'::character varying, 'cost_center'::character varying, 'financial_center'::character varying, 'product'::character varying])::text[])))
);


ALTER TABLE public.t_d_sharing OWNER TO budget;

--
-- Name: t_d_sharing_sharing_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_d_sharing_sharing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_d_sharing_sharing_id_seq OWNER TO budget;

--
-- Name: t_d_sharing_sharing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_d_sharing_sharing_id_seq OWNED BY public.t_d_sharing.sharing_id;


--
-- Name: t_d_user; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_user (
    user_id integer NOT NULL,
    user_name character varying NOT NULL,
    user_email character varying,
    user_login character varying,
    user_password character varying,
    user_telegram_id bigint,
    refresh_token character varying,
    auth_method character varying NOT NULL,
    is_active boolean NOT NULL,
    created_dttm timestamp with time zone DEFAULT now(),
    updated_dttm timestamp with time zone DEFAULT now(),
    user_role character varying(20) DEFAULT 'user'::character varying NOT NULL,
    CONSTRAINT ck_t_d_user_role CHECK (((user_role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying])::text[])))
);


ALTER TABLE public.t_d_user OWNER TO budget;

--
-- Name: t_d_user_user_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_d_user_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_d_user_user_id_seq OWNER TO budget;

--
-- Name: t_d_user_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_d_user_user_id_seq OWNED BY public.t_d_user.user_id;


--
-- Name: t_f_product_price; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_f_product_price (
    price_id integer NOT NULL,
    product_id integer NOT NULL,
    supplier_name character varying(255),
    price_value numeric(10,2) NOT NULL,
    price_date date DEFAULT CURRENT_DATE NOT NULL,
    user_id integer NOT NULL,
    created_dttm timestamp with time zone DEFAULT now()
);


ALTER TABLE public.t_f_product_price OWNER TO budget;

--
-- Name: t_f_product_price_price_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_f_product_price_price_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_f_product_price_price_id_seq OWNER TO budget;

--
-- Name: t_f_product_price_price_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_f_product_price_price_id_seq OWNED BY public.t_f_product_price.price_id;


--
-- Name: t_f_registry; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_f_registry (
    registry_id integer NOT NULL,
    operation_dttm timestamp without time zone NOT NULL,
    user_id integer NOT NULL,
    period_id integer NOT NULL,
    financial_center_id integer NOT NULL,
    cost_center_id integer,
    nomenclature_id integer NOT NULL,
    row_type_id integer NOT NULL,
    cost_sum numeric(10,2) NOT NULL,
    comment_description character varying
);


ALTER TABLE public.t_f_registry OWNER TO budget;

--
-- Name: t_f_registry_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_f_registry_registry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_f_registry_registry_id_seq OWNER TO budget;

--
-- Name: t_f_registry_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_f_registry_registry_id_seq OWNED BY public.t_f_registry.registry_id;


--
-- Name: t_l_product_nomenclature; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_l_product_nomenclature (
    product_id integer NOT NULL,
    nomenclature_id integer NOT NULL,
    created_dttm timestamp with time zone DEFAULT now()
);


ALTER TABLE public.t_l_product_nomenclature OWNER TO budget;

--
-- Name: t_d_cost_center cost_center_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_cost_center ALTER COLUMN cost_center_id SET DEFAULT nextval('public.t_d_cost_center_cost_center_id_seq'::regclass);


--
-- Name: t_d_financial_center financial_center_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_financial_center ALTER COLUMN financial_center_id SET DEFAULT nextval('public.t_d_financial_center_financial_center_id_seq'::regclass);


--
-- Name: t_d_nomenclature nomenclature_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_nomenclature ALTER COLUMN nomenclature_id SET DEFAULT nextval('public.t_d_nomenclature_nomenclature_id_seq'::regclass);


--
-- Name: t_d_period period_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_period ALTER COLUMN period_id SET DEFAULT nextval('public.t_d_period_period_id_seq'::regclass);


--
-- Name: t_d_product product_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_product ALTER COLUMN product_id SET DEFAULT nextval('public.t_d_product_product_id_seq'::regclass);


--
-- Name: t_d_row_type row_type_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_row_type ALTER COLUMN row_type_id SET DEFAULT nextval('public.t_d_row_type_row_type_id_seq'::regclass);


--
-- Name: t_d_sharing sharing_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_sharing ALTER COLUMN sharing_id SET DEFAULT nextval('public.t_d_sharing_sharing_id_seq'::regclass);


--
-- Name: t_d_user user_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_user ALTER COLUMN user_id SET DEFAULT nextval('public.t_d_user_user_id_seq'::regclass);


--
-- Name: t_f_product_price price_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_product_price ALTER COLUMN price_id SET DEFAULT nextval('public.t_f_product_price_price_id_seq'::regclass);


--
-- Name: t_f_registry registry_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_registry ALTER COLUMN registry_id SET DEFAULT nextval('public.t_f_registry_registry_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.alembic_version (version_num) FROM stdin;
86027abaa82e
\.


--
-- Data for Name: t_d_cost_center; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_cost_center (cost_center_id, cost_center_name, is_active, user_id, created_at, updated_at) FROM stdin;
3	Авто	t	3	2025-09-03 14:14:46.008482	\N
4	Test МВЗ	t	1	2025-09-03 18:04:49.397445	2025-09-03 18:04:49.397445
5	Авто	t	8	2025-09-04 11:53:33.087907	\N
10	Test Cost Center	t	17	2025-09-13 12:17:41.569632	\N
12	Test Cost Center	t	18	2025-09-13 12:19:30.778371	\N
14	Test Cost Center	t	21	2025-09-13 12:20:32.151483	\N
\.


--
-- Data for Name: t_d_financial_center; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_financial_center (financial_center_id, financial_center_name, is_active, user_id, created_at, updated_at) FROM stdin;
4	Семья	t	3	2025-09-03 13:52:57.045902	\N
6	Семья	t	8	2025-09-04 11:53:27.454432	\N
9	Updated Financial Center	f	12	2025-09-12 17:41:04.867469	2025-09-12 17:41:47.471741
11	Test Financial Center	t	17	2025-09-13 12:17:41.540962	\N
13	Test Financial Center	t	18	2025-09-13 12:19:30.75162	\N
14	Duplicate Test Center	t	20	2025-09-13 12:19:54.692855	\N
16	Test Financial Center	t	21	2025-09-13 12:20:32.124979	\N
17	Duplicate Test Center	t	23	2025-09-13 12:20:36.988585	\N
\.


--
-- Data for Name: t_d_nomenclature; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_nomenclature (nomenclature_id, nomenclature_name, account_name, bill_name, operation_name, is_budget, is_fact, nomenclature_type, is_active, user_id, parent_id, created_at, updated_at) FROM stdin;
1	Продукты	Гипермаркет	Гипермаркет	Списание	t	t	EXPENSE	t	3	\N	2025-09-03 14:15:36.157731	\N
3	Продукты	Гипермаркет	Гипермаркет	Списание	t	t	EXPENSE	t	8	\N	2025-09-04 11:53:44.086213	\N
6	Test Nomenclature	Test Account	Test Bill	Test Operation	t	t	EXPENSE	t	12	\N	2025-09-12 17:41:33.62704	\N
8	Test Nomenclature	Test Account	Test Bill	Test Operation	t	t	EXPENSE	t	17	\N	2025-09-13 12:17:41.610424	\N
10	Test Nomenclature	Test Account	Test Bill	Test Operation	t	t	EXPENSE	t	18	\N	2025-09-13 12:19:30.820336	\N
11	Duplicate Test Nomenclature	Test Account	Test Bill	Test Operation	t	t	EXPENSE	t	20	\N	2025-09-13 12:19:54.704542	\N
13	Test Nomenclature	Duplicate Account	Duplicate Bill	Duplicate Operation	t	t	EXPENSE	t	21	\N	2025-09-13 12:20:32.197689	\N
14	Duplicate Test Nomenclature	Test Account	Test Bill	Test Operation	t	t	EXPENSE	t	23	\N	2025-09-13 12:20:37.052684	\N
\.


--
-- Data for Name: t_d_period; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_period (period_id, period_dt, period_ru_name, period_start_date, period_end_date, user_id) FROM stdin;
11	2024-01-01 00:00:00	2024.01 - Январь	2024-01-01 00:00:00	2024-01-31 00:00:00	3
12	2024-02-01 00:00:00	2024.02 - Февраль	2024-02-01 00:00:00	2024-02-29 00:00:00	3
13	2024-03-01 00:00:00	2024.03 - Март	2024-03-01 00:00:00	2024-03-31 00:00:00	5
14	2024-04-01 00:00:00	2024.04 - Апрель	2024-04-01 00:00:00	2024-04-30 00:00:00	5
15	2024-05-01 00:00:00	2024.05 - Май	2024-05-01 00:00:00	2024-05-31 00:00:00	6
16	2024-06-01 00:00:00	2024.06 - Июнь	2024-06-01 00:00:00	2024-06-30 00:00:00	6
17	2024-07-01 00:00:00	2024.07 - Июль	2024-07-01 00:00:00	2024-07-31 00:00:00	7
18	2024-08-01 00:00:00	2024.08 - Август	2024-08-01 00:00:00	2024-08-31 00:00:00	7
49	2023-11-01 00:00:00	2023.11 - Ноябрь (Test Admin)	\N	\N	9993
50	2023-12-01 00:00:00	2023.12 - Декабрь (Test Admin)	\N	\N	9993
59	2025-01-01 00:00:00	Январь 2025	\N	\N	18
60	2025-12-01 00:00:00	2025.12	\N	\N	18
62	2025-01-01 00:00:00	Duplicate Period	\N	\N	21
63	2025-12-01 00:00:00	2025.12	\N	\N	21
65	2025-05-01 00:00:00	2025 Май	2025-04-30 21:00:00	2025-05-30 21:00:00	11
8	2026-09-01 00:00:00	2026.09 - Сентябрь	\N	\N	1
\.


--
-- Data for Name: t_d_product; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_product (product_id, product_name, category_name, unit_measure, barcode, description, is_active, created_dttm, updated_dttm) FROM stdin;
1	Updated Test Product	Test Category	шт	\N	Updated description	f	2025-09-04 17:22:53.877365+00	2025-09-04 17:23:09.950154+00
2	вапв	Продукты питания	шт	\N	\N	f	2025-09-08 04:21:31.162324+00	2025-09-08 12:28:07.136259+00
3	вава	Продукты питания	шт	\N	\N	f	2025-09-11 14:51:15.044354+00	2025-09-11 14:51:21.971134+00
4	Хлеб	Продукты питания	шт	\N	\N	f	2025-09-12 13:10:31.832834+00	2025-09-12 13:11:12.899091+00
\.


--
-- Data for Name: t_d_row_type; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_row_type (row_type_id, row_type_name) FROM stdin;
1	Plan
2	Fact
\.


--
-- Data for Name: t_d_sharing; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_sharing (sharing_id, owner_user_id, shared_with_user_id, resource_type, resource_id, permission_type, is_active, created_dttm, updated_dttm) FROM stdin;
\.


--
-- Data for Name: t_d_user; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_user (user_id, user_name, user_email, user_login, user_password, user_telegram_id, refresh_token, auth_method, is_active, created_dttm, updated_dttm, user_role) FROM stdin;
16	Debug User	\N	debuguser	$2b$12$IuAU40SHsG/hP4UKtOaHL.O0Ze.z556yAodVAUitO8n9WzdsW.1ua	\N	\N	password	t	2025-09-13 10:08:16.017119+00	2025-09-13 10:08:16.017119+00	user
17	API Test User	apitest@example.com	testuser_api	$2b$12$iYxOr90BgBAYH0XC7i7/L.c.kEs1F5KP/ch3pfazfGZTPBMkqPGYG	\N	\N	password	t	2025-09-13 12:17:41.107917+00	2025-09-13 12:17:41.107917+00	user
18	API Test User	apitest_1757765970@example.com	testuser_api_1757765970	$2b$12$hEV3aFijOTsuN.jZxyC9/emZJhxf9wnhdWyG1RJNraMzYlJuzNsWu	\N	\N	password	t	2025-09-13 12:19:30.318394+00	2025-09-13 12:19:30.318394+00	user
19	Second API Test User	apitest2_1757765971@example.com	testuser2_api_1757765971	$2b$12$4bV2IYEomBPxStav8L/IKOZ1fKBz.AAgPHxn.PuFQkGqWivdqDtu6	\N	\N	password	t	2025-09-13 12:19:30.828907+00	2025-09-13 12:19:30.828907+00	user
20	Debug User	debug_1757765994@example.com	debug_user_1757765994	$2b$12$zqsSS3aOKzrZIBK4s6rur.jIEgE0KpM6gldTTOsXmpZ1.quVPNylu	\N	\N	password	t	2025-09-13 12:19:54.307599+00	2025-09-13 12:19:54.307599+00	user
21	API Test User	apitest_1757766031@example.com	testuser_api_1757766031	$2b$12$Ie2wgIJJw7.hWYUvmqwa9.G1VQDxE4dY.22hl4RJRgPD3TcrfNGpy	\N	\N	password	t	2025-09-13 12:20:31.689115+00	2025-09-13 12:20:31.689115+00	user
22	Second API Test User	apitest2_1757766033@example.com	testuser2_api_1757766033	$2b$12$qQePMPxTIn4Ou6uuX.9vC.ss0tY6AJrQWHvZKl.w3VaucwS8mPjo.	\N	\N	password	t	2025-09-13 12:20:32.207995+00	2025-09-13 12:20:32.207995+00	user
23	Debug User	debug_1757766036@example.com	debug_user_1757766036	$2b$12$urgW0Ce/uRCmgYFjkBw2Wet1Nsg7Rzx.BoqoDJDSL/rd.WPnaprlm	\N	\N	password	t	2025-09-13 12:20:36.621+00	2025-09-13 12:20:36.621+00	user
1	Administrator	admin@example.com	admin	$2b$12$SozEUMv3HwC5S0e9zTbGGOzxtOIMaOaKlYj7ljrpNSjn4WQD2SNw.	\N	\N	password	t	2025-08-25 10:53:20.29221+00	2025-08-25 10:53:20.29221+00	admin
3	Ikeniborn User	\N	ikeniborn	$2b$12$4.aT2xQtxt39u76OHVczZOCx7D2pxMDjj2Zk5QxIatDbMz.HVxJqS	\N	\N	password	t	2025-08-25 10:59:04.275466+00	2025-09-11 14:15:28.938361+00	admin
9	Normal User	\N	normaluser	$2b$12$ucnojxagoQO7AS21MHnpxee/dOAshTEuFH4l9hgzYeJbygQvuT4ue	\N	\N	password	f	2025-09-08 16:20:32.683899+00	2025-09-11 14:15:34.215436+00	user
9991	Test User 1	test1@security.test	sectest1	\N	1111111111	\N	telegram	f	2025-09-08 16:37:50.882379+00	2025-09-11 14:15:36.51119+00	user
9992	Test User 2	test2@security.test	sectest2	\N	2222222222	\N	telegram	f	2025-09-08 16:37:50.882379+00	2025-09-11 14:15:39.603991+00	user
9993	Test Admin	admin@security.test	secadmin	\N	3333333333	\N	telegram	f	2025-09-08 16:37:50.882379+00	2025-09-11 14:15:51.560377+00	admin
11	test5 test5	\N	test5	$2b$12$/395J/OjPjITu1j9/FSi2u6Cshv3hvwTgjusJPVgMeLW8ztaD1P5G	\N	\N	password	t	2025-09-12 10:27:38.624147+00	2025-09-12 10:27:38.624147+00	user
8	[УДАЛЕН] Илья Тищенко	\N	test3	$2b$12$HPHO/CP.4m49IiJEeUvSzOjVJBeaPPafIA3qW0klSZKAXXJ7bFPzq	\N	\N	password	f	2025-09-04 11:53:03.709303+00	2025-09-12 10:33:07.70523+00	user
7	[УДАЛЕН] Product Test User	testproduct@example.com	testproduct	$2b$12$ZiWAokeoORjYFyTYHdptWuzaGPhy6PrlZra4u.0B6oDS5wjlUVUsy	\N	\N	password	f	2025-09-01 04:47:05.229298+00	2025-09-12 10:33:10.283538+00	user
6	[УДАЛЕН] Test Auth User	test@example.com	testauth	$2b$12$BizuENA89qJ70rCGNX2QxOEyGzOgLrVkgEEWafDNY7EfWrH4UFfpO	\N	\N	password	f	2025-08-31 14:07:35.996989+00	2025-09-12 10:33:12.047037+00	user
5	[УДАЛЕН] Test Two	test2@example.com	test2	$2b$12$lOHcSNeY7YOztmhXa464JuoAav3OGTRGHvewvbyuzkOGlkVCtySh.	\N	\N	password	f	2025-08-27 14:38:21.206877+00	2025-09-12 10:33:13.6852+00	user
4	[УДАЛЕН] Test User	test@test.com	testuser	$2b$12$UVij6Gb5HVW4p9.RRRndvull7DgqLhCFKzKu4h44eDJ8926tFC9eK	\N	\N	password	f	2025-08-25 11:16:55.852885+00	2025-09-12 10:33:15.530125+00	user
12	Test User 2	test2@example.com	testuser2	$2b$12$KZo2YKgQZTMLEY.iqKtNle9qnkjzZ/.4jUvZkxhftthZ6kZhzcC8a	\N	\N	password	t	2025-09-12 17:28:35.648744+00	2025-09-12 17:28:35.648744+00	user
13	Test User 3	test3@example.com	testuser3	$2b$12$sT9iJnrCe6WUscKHnCgqOugxx0al4NYr8wca9aMkdlHi80klU/LUO	\N	\N	password	t	2025-09-12 17:42:07.871497+00	2025-09-12 17:42:07.871497+00	user
14	User One	user1@example.com	user1	$2b$12$YFQdaolAN1YQ3AoZIZd15ujNOBIKmgzMvziHds9P4R9JGCY4o07pq	\N	\N	password	t	2025-09-13 06:07:23.618192+00	2025-09-13 06:07:23.618192+00	user
15	Rapid User	rapid@example.com	rapiduser	$2b$12$.Uh2jlI03H/pbYm/ason1u1D29y1HAFq57NVqsuSeQ648/Lxn8sUO	\N	\N	password	t	2025-09-13 06:07:24.814347+00	2025-09-13 06:07:24.814347+00	user
\.


--
-- Data for Name: t_f_product_price; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_f_product_price (price_id, product_id, supplier_name, price_value, price_date, user_id, created_dttm) FROM stdin;
\.


--
-- Data for Name: t_f_registry; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_f_registry (registry_id, operation_dttm, user_id, period_id, financial_center_id, cost_center_id, nomenclature_id, row_type_id, cost_sum, comment_description) FROM stdin;
15	2025-09-04 00:00:00	3	8	4	\N	1	2	12.00	\N
16	2025-09-04 00:00:00	3	8	4	\N	1	2	12.00	\N
17	2025-09-04 00:00:00	3	8	4	\N	1	2	456.00	\N
\.


--
-- Data for Name: t_l_product_nomenclature; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_l_product_nomenclature (product_id, nomenclature_id, created_dttm) FROM stdin;
\.


--
-- Name: t_d_cost_center_cost_center_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_cost_center_cost_center_id_seq', 14, true);


--
-- Name: t_d_financial_center_financial_center_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_financial_center_financial_center_id_seq', 17, true);


--
-- Name: t_d_nomenclature_nomenclature_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_nomenclature_nomenclature_id_seq', 14, true);


--
-- Name: t_d_period_period_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_period_period_id_seq', 65, true);


--
-- Name: t_d_product_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_product_product_id_seq', 4, true);


--
-- Name: t_d_row_type_row_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_row_type_row_type_id_seq', 1, false);


--
-- Name: t_d_sharing_sharing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_sharing_sharing_id_seq', 1, false);


--
-- Name: t_d_user_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_user_user_id_seq', 23, true);


--
-- Name: t_f_product_price_price_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_f_product_price_price_id_seq', 1, false);


--
-- Name: t_f_registry_registry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_f_registry_registry_id_seq', 19, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: t_d_cost_center pk_t_d_cost_center; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_cost_center
    ADD CONSTRAINT pk_t_d_cost_center PRIMARY KEY (cost_center_id);


--
-- Name: t_d_financial_center pk_t_d_financial_center; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_financial_center
    ADD CONSTRAINT pk_t_d_financial_center PRIMARY KEY (financial_center_id);


--
-- Name: t_d_nomenclature pk_t_d_nomenclature; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_nomenclature
    ADD CONSTRAINT pk_t_d_nomenclature PRIMARY KEY (nomenclature_id);


--
-- Name: t_d_period pk_t_d_period; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_period
    ADD CONSTRAINT pk_t_d_period PRIMARY KEY (period_id);


--
-- Name: t_d_product pk_t_d_product; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_product
    ADD CONSTRAINT pk_t_d_product PRIMARY KEY (product_id);


--
-- Name: t_d_row_type pk_t_d_row_type; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_row_type
    ADD CONSTRAINT pk_t_d_row_type PRIMARY KEY (row_type_id);


--
-- Name: t_d_user pk_t_d_user; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_user
    ADD CONSTRAINT pk_t_d_user PRIMARY KEY (user_id);


--
-- Name: t_f_product_price pk_t_f_product_price; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_product_price
    ADD CONSTRAINT pk_t_f_product_price PRIMARY KEY (price_id);


--
-- Name: t_f_registry pk_t_f_registry; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_registry
    ADD CONSTRAINT pk_t_f_registry PRIMARY KEY (registry_id);


--
-- Name: t_l_product_nomenclature pk_t_l_product_nomenclature; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_l_product_nomenclature
    ADD CONSTRAINT pk_t_l_product_nomenclature PRIMARY KEY (product_id, nomenclature_id);


--
-- Name: t_d_sharing t_d_sharing_pkey; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_sharing
    ADD CONSTRAINT t_d_sharing_pkey PRIMARY KEY (sharing_id);


--
-- Name: t_d_period unique_period_date_user; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_period
    ADD CONSTRAINT unique_period_date_user UNIQUE (period_dt, user_id);


--
-- Name: t_d_sharing uq_t_d_sharing_owner_shared_resource; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_sharing
    ADD CONSTRAINT uq_t_d_sharing_owner_shared_resource UNIQUE (owner_user_id, shared_with_user_id, resource_type, resource_id);


--
-- Name: t_d_user uq_t_d_user_user_login; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_user
    ADD CONSTRAINT uq_t_d_user_user_login UNIQUE (user_login);


--
-- Name: t_d_user uq_t_d_user_user_telegram_id; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_user
    ADD CONSTRAINT uq_t_d_user_user_telegram_id UNIQUE (user_telegram_id);


--
-- Name: idx_cost_center_name_system_unique; Type: INDEX; Schema: public; Owner: budget
--

CREATE UNIQUE INDEX idx_cost_center_name_system_unique ON public.t_d_cost_center USING btree (cost_center_name) WHERE (user_id IS NULL);


--
-- Name: idx_cost_center_name_user_unique; Type: INDEX; Schema: public; Owner: budget
--

CREATE UNIQUE INDEX idx_cost_center_name_user_unique ON public.t_d_cost_center USING btree (cost_center_name, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_cost_center_user_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_cost_center_user_id ON public.t_d_cost_center USING btree (user_id);


--
-- Name: idx_financial_center_name_system_unique; Type: INDEX; Schema: public; Owner: budget
--

CREATE UNIQUE INDEX idx_financial_center_name_system_unique ON public.t_d_financial_center USING btree (financial_center_name) WHERE (user_id IS NULL);


--
-- Name: idx_financial_center_name_user_unique; Type: INDEX; Schema: public; Owner: budget
--

CREATE UNIQUE INDEX idx_financial_center_name_user_unique ON public.t_d_financial_center USING btree (financial_center_name, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_financial_center_user_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_financial_center_user_id ON public.t_d_financial_center USING btree (user_id);


--
-- Name: idx_nomenclature_name_system_unique; Type: INDEX; Schema: public; Owner: budget
--

CREATE UNIQUE INDEX idx_nomenclature_name_system_unique ON public.t_d_nomenclature USING btree (nomenclature_name) WHERE (user_id IS NULL);


--
-- Name: idx_nomenclature_name_user_unique; Type: INDEX; Schema: public; Owner: budget
--

CREATE UNIQUE INDEX idx_nomenclature_name_user_unique ON public.t_d_nomenclature USING btree (nomenclature_name, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_nomenclature_parent_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_nomenclature_parent_id ON public.t_d_nomenclature USING btree (parent_id);


--
-- Name: idx_nomenclature_user_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_nomenclature_user_id ON public.t_d_nomenclature USING btree (user_id);


--
-- Name: idx_product_active; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_active ON public.t_d_product USING btree (is_active);


--
-- Name: idx_product_barcode; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_barcode ON public.t_d_product USING btree (barcode);


--
-- Name: idx_product_category; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_category ON public.t_d_product USING btree (category_name);


--
-- Name: idx_product_name; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_name ON public.t_d_product USING btree (product_name);


--
-- Name: idx_product_nomenclature_nom; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_nomenclature_nom ON public.t_l_product_nomenclature USING btree (nomenclature_id);


--
-- Name: idx_product_nomenclature_product; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_nomenclature_product ON public.t_l_product_nomenclature USING btree (product_id);


--
-- Name: idx_product_price_date; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_price_date ON public.t_f_product_price USING btree (price_date);


--
-- Name: idx_product_price_product; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_price_product ON public.t_f_product_price USING btree (product_id);


--
-- Name: idx_product_price_supplier; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_price_supplier ON public.t_f_product_price USING btree (supplier_name);


--
-- Name: idx_product_price_user; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX idx_product_price_user ON public.t_f_product_price USING btree (user_id);


--
-- Name: ix_t_d_cost_center_cost_center_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_cost_center_cost_center_id ON public.t_d_cost_center USING btree (cost_center_id);


--
-- Name: ix_t_d_financial_center_financial_center_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_financial_center_financial_center_id ON public.t_d_financial_center USING btree (financial_center_id);


--
-- Name: ix_t_d_nomenclature_nomenclature_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_nomenclature_nomenclature_id ON public.t_d_nomenclature USING btree (nomenclature_id);


--
-- Name: ix_t_d_period_period_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_period_period_id ON public.t_d_period USING btree (period_id);


--
-- Name: ix_t_d_period_user_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_period_user_id ON public.t_d_period USING btree (user_id);


--
-- Name: ix_t_d_product_product_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_product_product_id ON public.t_d_product USING btree (product_id);


--
-- Name: ix_t_d_row_type_row_type_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_row_type_row_type_id ON public.t_d_row_type USING btree (row_type_id);


--
-- Name: ix_t_d_sharing_active; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_sharing_active ON public.t_d_sharing USING btree (is_active) WHERE (is_active = true);


--
-- Name: ix_t_d_sharing_owner_resource; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_sharing_owner_resource ON public.t_d_sharing USING btree (owner_user_id, resource_type);


--
-- Name: ix_t_d_sharing_owner_user_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_sharing_owner_user_id ON public.t_d_sharing USING btree (owner_user_id);


--
-- Name: ix_t_d_sharing_resource_type; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_sharing_resource_type ON public.t_d_sharing USING btree (resource_type);


--
-- Name: ix_t_d_sharing_shared_resource; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_sharing_shared_resource ON public.t_d_sharing USING btree (shared_with_user_id, resource_type);


--
-- Name: ix_t_d_sharing_shared_with_user_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_sharing_shared_with_user_id ON public.t_d_sharing USING btree (shared_with_user_id);


--
-- Name: ix_t_d_user_user_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_user_user_id ON public.t_d_user USING btree (user_id);


--
-- Name: ix_t_d_user_user_role; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_user_user_role ON public.t_d_user USING btree (user_role);


--
-- Name: ix_t_f_product_price_price_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_f_product_price_price_id ON public.t_f_product_price USING btree (price_id);


--
-- Name: ix_t_f_registry_registry_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_f_registry_registry_id ON public.t_f_registry USING btree (registry_id);


--
-- Name: t_d_period fk_t_d_period_user_id_t_d_user; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_period
    ADD CONSTRAINT fk_t_d_period_user_id_t_d_user FOREIGN KEY (user_id) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_sharing fk_t_d_sharing_owner_user_id; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_sharing
    ADD CONSTRAINT fk_t_d_sharing_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES public.t_d_user(user_id) ON DELETE CASCADE;


--
-- Name: t_d_sharing fk_t_d_sharing_shared_with_user_id; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_sharing
    ADD CONSTRAINT fk_t_d_sharing_shared_with_user_id FOREIGN KEY (shared_with_user_id) REFERENCES public.t_d_user(user_id) ON DELETE CASCADE;


--
-- Name: t_f_product_price fk_t_f_product_price_product_id_t_d_product; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_product_price
    ADD CONSTRAINT fk_t_f_product_price_product_id_t_d_product FOREIGN KEY (product_id) REFERENCES public.t_d_product(product_id) ON DELETE CASCADE;


--
-- Name: t_f_product_price fk_t_f_product_price_user_id_t_d_user; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_product_price
    ADD CONSTRAINT fk_t_f_product_price_user_id_t_d_user FOREIGN KEY (user_id) REFERENCES public.t_d_user(user_id);


--
-- Name: t_f_registry fk_t_f_registry_cost_center_id_t_d_cost_center; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_registry
    ADD CONSTRAINT fk_t_f_registry_cost_center_id_t_d_cost_center FOREIGN KEY (cost_center_id) REFERENCES public.t_d_cost_center(cost_center_id);


--
-- Name: t_f_registry fk_t_f_registry_financial_center_id_t_d_financial_center; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_registry
    ADD CONSTRAINT fk_t_f_registry_financial_center_id_t_d_financial_center FOREIGN KEY (financial_center_id) REFERENCES public.t_d_financial_center(financial_center_id);


--
-- Name: t_f_registry fk_t_f_registry_nomenclature_id_t_d_nomenclature; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_registry
    ADD CONSTRAINT fk_t_f_registry_nomenclature_id_t_d_nomenclature FOREIGN KEY (nomenclature_id) REFERENCES public.t_d_nomenclature(nomenclature_id);


--
-- Name: t_f_registry fk_t_f_registry_period_id_t_d_period; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_registry
    ADD CONSTRAINT fk_t_f_registry_period_id_t_d_period FOREIGN KEY (period_id) REFERENCES public.t_d_period(period_id);


--
-- Name: t_f_registry fk_t_f_registry_row_type_id_t_d_row_type; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_registry
    ADD CONSTRAINT fk_t_f_registry_row_type_id_t_d_row_type FOREIGN KEY (row_type_id) REFERENCES public.t_d_row_type(row_type_id);


--
-- Name: t_f_registry fk_t_f_registry_user_id_t_d_user; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_f_registry
    ADD CONSTRAINT fk_t_f_registry_user_id_t_d_user FOREIGN KEY (user_id) REFERENCES public.t_d_user(user_id);


--
-- Name: t_l_product_nomenclature fk_t_l_product_nomenclature_nomenclature_id_t_d_nomenclature; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_l_product_nomenclature
    ADD CONSTRAINT fk_t_l_product_nomenclature_nomenclature_id_t_d_nomenclature FOREIGN KEY (nomenclature_id) REFERENCES public.t_d_nomenclature(nomenclature_id) ON DELETE CASCADE;


--
-- Name: t_l_product_nomenclature fk_t_l_product_nomenclature_product_id_t_d_product; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_l_product_nomenclature
    ADD CONSTRAINT fk_t_l_product_nomenclature_product_id_t_d_product FOREIGN KEY (product_id) REFERENCES public.t_d_product(product_id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

GRANT ALL ON SCHEMA public TO budget;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO budget;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO budget;


--
-- PostgreSQL database dump complete
--

\unrestrict 61RYjrAYP2sqixejbgPg9KyfDXNS8y4KqVtUYmvMjseEodizrguP9nIXC20Ftml

