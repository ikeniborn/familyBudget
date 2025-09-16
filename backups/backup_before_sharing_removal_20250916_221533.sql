--
-- PostgreSQL database dump
--

\restrict J1rF8sJWMx3B2TUixvBsx03p8KyB54l2GgqoPqHJom3DWwZcmbhexetSOXgreYG

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
-- Name: t_d_article; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_article (
    article_id integer NOT NULL,
    article_code character varying(50) NOT NULL,
    article_name character varying NOT NULL,
    description character varying(500),
    is_active boolean,
    user_id integer,
    created_by integer,
    managed_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.t_d_article OWNER TO budget;

--
-- Name: t_d_article_article_id_seq; Type: SEQUENCE; Schema: public; Owner: budget
--

CREATE SEQUENCE public.t_d_article_article_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.t_d_article_article_id_seq OWNER TO budget;

--
-- Name: t_d_article_article_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: budget
--

ALTER SEQUENCE public.t_d_article_article_id_seq OWNED BY public.t_d_article.article_id;


--
-- Name: t_d_cost_center; Type: TABLE; Schema: public; Owner: budget
--

CREATE TABLE public.t_d_cost_center (
    cost_center_id integer NOT NULL,
    cost_center_name character varying NOT NULL,
    is_active boolean DEFAULT true,
    user_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cost_center_code character varying(20) NOT NULL,
    created_by integer,
    managed_by integer,
    description character varying(500)
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
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    financial_center_code character varying(20) NOT NULL,
    created_by integer,
    managed_by integer,
    description character varying(500)
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
    account_name character varying,
    bill_name character varying,
    operation_name character varying,
    is_budget boolean NOT NULL,
    is_fact boolean NOT NULL,
    nomenclature_type character varying(20) DEFAULT 'EXPENSE'::character varying,
    is_active boolean DEFAULT true,
    user_id integer,
    parent_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    nomenclature_code character varying(50) NOT NULL,
    created_by integer,
    managed_by integer,
    description character varying(500),
    article_id integer
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
    user_id integer,
    period_code character varying(20) NOT NULL,
    created_by integer,
    managed_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
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
-- Name: t_d_article article_id; Type: DEFAULT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_article ALTER COLUMN article_id SET DEFAULT nextval('public.t_d_article_article_id_seq'::regclass);


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
db5be6413a0c
\.


--
-- Data for Name: t_d_article; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_article (article_id, article_code, article_name, description, is_active, user_id, created_by, managed_by, created_at, updated_at) FROM stdin;
1	HOUSEHOLD	Домашние расходы	Товары для дома и быта	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
2	TRANSPORT	Транспорт	Транспортные расходы	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
3	FOOD	Питание	Продукты питания и еда	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
4	UTILITIES	Коммунальные услуги	ЖКХ и коммунальные платежи	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
5	ENTERTAINMENT	Развлечения	Досуг и развлечения	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
6	HEALTHCARE	Здравоохранение	Медицинские услуги и лекарства	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
7	EDUCATION	Образование	Обучение и образовательные услуги	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
8	INCOME_SALARY	Зарплата	Доходы от основной работы	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
9	INCOME_BUSINESS	Бизнес	Доходы от предпринимательской деятельности	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
10	INCOME_INVESTMENT	Инвестиции	Доходы от инвестиций	t	\N	\N	\N	2025-09-15 20:57:30.847859+00	\N
\.


--
-- Data for Name: t_d_cost_center; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_cost_center (cost_center_id, cost_center_name, is_active, user_id, created_at, updated_at, cost_center_code, created_by, managed_by, description) FROM stdin;
3	Авто	t	3	2025-09-03 14:14:46.008482	\N	АВТ001	3	3	\N
15	ываы	t	\N	2025-09-15 11:07:03.983591	\N	ыва1	1	\N	\N
\.


--
-- Data for Name: t_d_financial_center; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_financial_center (financial_center_id, financial_center_name, is_active, user_id, created_at, updated_at, financial_center_code, created_by, managed_by, description) FROM stdin;
4	Семья	t	3	2025-09-03 13:52:57.045902	\N	СЕМ001	3	3	\N
19	Семья	t	\N	2025-09-15 11:06:47.418611	\N	па	1	\N	
\.


--
-- Data for Name: t_d_nomenclature; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_nomenclature (nomenclature_id, nomenclature_name, account_name, bill_name, operation_name, is_budget, is_fact, nomenclature_type, is_active, user_id, parent_id, created_at, updated_at, nomenclature_code, created_by, managed_by, description, article_id) FROM stdin;
1	Продукты	Гипермаркет	Гипермаркет	Списание	t	t	EXPENSE	t	3	\N	2025-09-03 14:15:36.157731	\N	ПРОДУ001	3	3	\N	\N
18	ываыв	\N	\N	\N	t	t	EXPENSE	t	\N	\N	2025-09-15 17:38:19.320413	2025-09-16 05:10:49.688032	н1	1	\N	\N	3
\.


--
-- Data for Name: t_d_period; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_period (period_id, period_dt, period_ru_name, period_start_date, period_end_date, user_id, period_code, created_by, managed_by, created_at, updated_at) FROM stdin;
11	2024-01-01 00:00:00	2024.01 - Январь	2024-01-01 00:00:00	2024-01-31 00:00:00	3	202002	3	3	2025-09-14 18:39:33.128651+00	\N
12	2024-02-01 00:00:00	2024.02 - Февраль	2024-02-01 00:00:00	2024-02-29 00:00:00	3	202003	3	3	2025-09-14 18:39:33.128651+00	\N
49	2023-11-01 00:00:00	2023.11 - Ноябрь (Test Admin)	\N	\N	9993	202004	9993	9993	2025-09-14 18:39:33.128651+00	\N
50	2023-12-01 00:00:00	2023.12 - Декабрь (Test Admin)	\N	\N	9993	202005	9993	9993	2025-09-14 18:39:33.128651+00	\N
69	2025-09-01 00:00:00	2025 Сен	2025-08-31 21:00:00	2025-09-29 21:00:00	\N	202006	1	1	2025-09-16 19:11:27.698166+00	\N
70	2025-10-01 00:00:00	2025 Окт	2025-09-30 21:00:00	2025-10-30 21:00:00	\N	202007	1	1	2025-09-16 19:11:42.944828+00	\N
71	2025-11-01 00:00:00	2025 Ноя	2025-10-31 21:00:00	2025-11-29 21:00:00	\N	202008	1	1	2025-09-16 19:11:54.170453+00	\N
\.


--
-- Data for Name: t_d_product; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_d_product (product_id, product_name, category_name, unit_measure, barcode, description, is_active, created_dttm, updated_dttm) FROM stdin;
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
1	Administrator	admin@example.com	admin	$2b$12$SozEUMv3HwC5S0e9zTbGGOzxtOIMaOaKlYj7ljrpNSjn4WQD2SNw.	\N	\N	password	t	2025-08-25 10:53:20.29221+00	2025-08-25 10:53:20.29221+00	admin
3	Ikeniborn User	\N	ikeniborn	$2b$12$4.aT2xQtxt39u76OHVczZOCx7D2pxMDjj2Zk5QxIatDbMz.HVxJqS	\N	\N	password	t	2025-08-25 10:59:04.275466+00	2025-09-11 14:15:28.938361+00	admin
9993	Test Admin	admin@security.test	secadmin	\N	3333333333	\N	telegram	t	2025-09-08 16:37:50.882379+00	2025-09-15 11:11:07.870242+00	admin
26	Simple Test User	simple@example.com	testuser_simple	$2b$12$bDpmcfmyTRphbYJ/4QJDMumGwEQSGgHVd1ojr2TPymX/pleq8z5B2	\N	\N	password	t	2025-09-15 18:02:44.197972+00	2025-09-15 18:02:44.197972+00	user
27	Data Types Test User	datatypes@example.com	datatypes_user	$2b$12$2xUXXPQPa5EtKtRh3N5DQONKcYCTy4YAKaHd.RvLuxhXhllhm/ySC	\N	\N	password	t	2025-09-15 18:02:44.706244+00	2025-09-15 18:02:44.706244+00	user
28	Consistency Test User	consistency@example.com	consistency_user	$2b$12$VxzPmUlDDmw65nkP4hVDF.p9ncK2YTgXs3izJbqQ.r7gLxFhGpjF2	\N	\N	password	t	2025-09-15 18:02:45.139011+00	2025-09-15 18:02:45.139011+00	user
29	With Data Test User	withdata@example.com	withdata_user	$2b$12$94Zp1L1.vQeW5M1atmc1GeHrZHIa12q.OAibz614lpWWGCKUAf5IS	\N	\N	password	t	2025-09-15 18:02:45.654176+00	2025-09-15 18:02:45.654176+00	user
30	Isolation User One	isolation1@example.com	isolation_user1	$2b$12$MKKSwuPMEs9ItjXQtR6PM.BQAvtdWpB6NJbHMcboBkDwoBayknhke	\N	\N	password	t	2025-09-15 18:02:46.108738+00	2025-09-15 18:02:46.108738+00	user
31	Test User	test@example.com	test_simple	$2b$12$jAWy5BSHyecglsjcMMknzeP/afYC/2zTD5JJn6r26heEABboC.hBu	\N	\N	password	t	2025-09-15 18:02:58.409933+00	2025-09-15 18:02:58.409933+00	user
32	test test	\N	ikeniborn2	$2b$12$XP0WTX031Ni50bGwDm22SOYHH9FHmxuAquvkFx25a3gC2PM3hHRmG	\N	\N	password	t	2025-09-16 14:08:05.999205+00	2025-09-16 14:08:05.999205+00	user
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
\.


--
-- Data for Name: t_l_product_nomenclature; Type: TABLE DATA; Schema: public; Owner: budget
--

COPY public.t_l_product_nomenclature (product_id, nomenclature_id, created_dttm) FROM stdin;
\.


--
-- Name: t_d_article_article_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_article_article_id_seq', 10, true);


--
-- Name: t_d_cost_center_cost_center_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_cost_center_cost_center_id_seq', 15, true);


--
-- Name: t_d_financial_center_financial_center_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_financial_center_financial_center_id_seq', 19, true);


--
-- Name: t_d_nomenclature_nomenclature_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_nomenclature_nomenclature_id_seq', 18, true);


--
-- Name: t_d_period_period_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_d_period_period_id_seq', 71, true);


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

SELECT pg_catalog.setval('public.t_d_user_user_id_seq', 32, true);


--
-- Name: t_f_product_price_price_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_f_product_price_price_id_seq', 1, false);


--
-- Name: t_f_registry_registry_id_seq; Type: SEQUENCE SET; Schema: public; Owner: budget
--

SELECT pg_catalog.setval('public.t_f_registry_registry_id_seq', 19, true);


--
-- Name: t_d_cost_center _cost_center_code_uc; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_cost_center
    ADD CONSTRAINT _cost_center_code_uc UNIQUE (cost_center_code);


--
-- Name: t_d_financial_center _financial_center_code_uc; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_financial_center
    ADD CONSTRAINT _financial_center_code_uc UNIQUE (financial_center_code);


--
-- Name: t_d_nomenclature _nomenclature_code_uc; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_nomenclature
    ADD CONSTRAINT _nomenclature_code_uc UNIQUE (nomenclature_code);


--
-- Name: t_d_period _period_code_uc; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_period
    ADD CONSTRAINT _period_code_uc UNIQUE (period_code);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: t_d_article pk_t_d_article; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_article
    ADD CONSTRAINT pk_t_d_article PRIMARY KEY (article_id);


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
-- Name: t_d_article uq_t_d_article_article_code; Type: CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_article
    ADD CONSTRAINT uq_t_d_article_article_code UNIQUE (article_code);


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
-- Name: ix_t_d_article_article_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_article_article_id ON public.t_d_article USING btree (article_id);


--
-- Name: ix_t_d_article_user_id; Type: INDEX; Schema: public; Owner: budget
--

CREATE INDEX ix_t_d_article_user_id ON public.t_d_article USING btree (user_id);


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
-- Name: t_d_cost_center fk_cost_center_created_by; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_cost_center
    ADD CONSTRAINT fk_cost_center_created_by FOREIGN KEY (created_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_cost_center fk_cost_center_managed_by; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_cost_center
    ADD CONSTRAINT fk_cost_center_managed_by FOREIGN KEY (managed_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_financial_center fk_financial_center_created_by; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_financial_center
    ADD CONSTRAINT fk_financial_center_created_by FOREIGN KEY (created_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_financial_center fk_financial_center_managed_by; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_financial_center
    ADD CONSTRAINT fk_financial_center_managed_by FOREIGN KEY (managed_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_nomenclature fk_nomenclature_created_by; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_nomenclature
    ADD CONSTRAINT fk_nomenclature_created_by FOREIGN KEY (created_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_nomenclature fk_nomenclature_managed_by; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_nomenclature
    ADD CONSTRAINT fk_nomenclature_managed_by FOREIGN KEY (managed_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_period fk_period_created_by; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_period
    ADD CONSTRAINT fk_period_created_by FOREIGN KEY (created_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_period fk_period_managed_by; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_period
    ADD CONSTRAINT fk_period_managed_by FOREIGN KEY (managed_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_article fk_t_d_article_created_by_t_d_user; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_article
    ADD CONSTRAINT fk_t_d_article_created_by_t_d_user FOREIGN KEY (created_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_article fk_t_d_article_managed_by_t_d_user; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_article
    ADD CONSTRAINT fk_t_d_article_managed_by_t_d_user FOREIGN KEY (managed_by) REFERENCES public.t_d_user(user_id);


--
-- Name: t_d_nomenclature fk_t_d_nomenclature_article_id_t_d_article; Type: FK CONSTRAINT; Schema: public; Owner: budget
--

ALTER TABLE ONLY public.t_d_nomenclature
    ADD CONSTRAINT fk_t_d_nomenclature_article_id_t_d_article FOREIGN KEY (article_id) REFERENCES public.t_d_article(article_id);


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

\unrestrict J1rF8sJWMx3B2TUixvBsx03p8KyB54l2GgqoPqHJom3DWwZcmbhexetSOXgreYG

