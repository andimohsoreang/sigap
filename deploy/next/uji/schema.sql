--
-- PostgreSQL database dump
--

\restrict ccuji

-- Dumped from database version 16.16 (Homebrew)
-- Dumped by pg_dump version 16.16 (Homebrew)

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_activations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_activations (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    conversation_id bigint,
    created_by bigint,
    purpose character varying(20) DEFAULT 'aktivasi'::character varying NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp(0) without time zone NOT NULL,
    used_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: account_activations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_activations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_activations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_activations_id_seq OWNED BY public.account_activations.id;


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id bigint NOT NULL,
    user_id bigint,
    username character varying(100),
    action character varying(100) NOT NULL,
    subject_type character varying(150),
    subject_id character varying(100),
    description text,
    properties json,
    ip_address character varying(45),
    user_agent character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: ai_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_calls (
    id bigint NOT NULL,
    task character varying(40) NOT NULL,
    prompt_version character varying(64),
    provider character varying(120),
    model character varying(120),
    status character varying(16) NOT NULL,
    latency_ms integer NOT NULL,
    prompt_tokens integer,
    completion_tokens integer,
    conversation_id bigint,
    error_code character varying(40),
    created_at timestamp(0) without time zone
);


--
-- Name: ai_calls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_calls_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_calls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_calls_id_seq OWNED BY public.ai_calls.id;


--
-- Name: ai_quality_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_quality_runs (
    id bigint NOT NULL,
    model character varying(120),
    with_model boolean NOT NULL,
    passed boolean,
    retrieval_hits smallint NOT NULL,
    retrieval_total smallint NOT NULL,
    classification_hits smallint NOT NULL,
    classification_total smallint NOT NULL,
    unsourced smallint NOT NULL,
    failed_calls smallint NOT NULL,
    number_rejections smallint NOT NULL,
    median_ms integer,
    p95_ms integer,
    failures character varying(255),
    duration_s integer NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: ai_quality_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_quality_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_quality_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_quality_runs_id_seq OWNED BY public.ai_quality_runs.id;


--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration integer NOT NULL
);


--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration integer NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    priority_default character varying(20) DEFAULT 'umum'::character varying NOT NULL,
    sla_days smallint DEFAULT '14'::smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: channel_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_sync_logs (
    id bigint NOT NULL,
    channel_id bigint,
    channel character varying(30),
    pulled_count integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'berhasil'::character varying NOT NULL,
    message text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: channel_sync_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_sync_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_sync_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_sync_logs_id_seq OWNED BY public.channel_sync_logs.id;


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id bigint NOT NULL,
    type character varying(20) NOT NULL,
    name character varying(120) NOT NULL,
    account_name character varying(120),
    url character varying(500),
    status character varying(30) DEFAULT 'aktif'::character varying NOT NULL,
    config json,
    last_synced_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: channels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channels_id_seq OWNED BY public.channels.id;


--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    id bigint NOT NULL,
    user_id bigint,
    guest_token character varying(64),
    subject character varying(200),
    last_message_at timestamp(0) without time zone,
    unread_admin integer DEFAULT 0 NOT NULL,
    unread_user integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    guest_name character varying(100),
    handled_by character varying(20) DEFAULT 'petugas'::character varying NOT NULL,
    handoff_at timestamp(0) without time zone,
    handoff_reason character varying(30),
    ai_summary text,
    reference character varying(20),
    contact text,
    assigned_to bigint,
    outcome character varying(30),
    closed_at timestamp(0) without time zone,
    closed_by bigint,
    ticket_id bigint,
    data_verified_at timestamp(0) without time zone,
    ai_pending_at timestamp(0) without time zone,
    province character varying(60),
    location character varying(150)
);


--
-- Name: chat_conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_conversations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_conversations_id_seq OWNED BY public.chat_conversations.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    sender_id bigint,
    sender_type character varying(20) DEFAULT 'user'::character varying NOT NULL,
    body text NOT NULL,
    read_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    meta json,
    feedback smallint
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: job_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: knowledge_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_articles (
    id bigint NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    category character varying(100),
    source character varying(255),
    source_ref character varying(100),
    status character varying(20) DEFAULT 'draf'::character varying NOT NULL,
    review_at date,
    knowledge_document_id bigint,
    created_by bigint,
    updated_by bigint,
    used_count integer DEFAULT 0 NOT NULL,
    helpful_count integer DEFAULT 0 NOT NULL,
    unhelpful_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    keywords character varying(500),
    source_url character varying(500),
    dasar_hukum character varying(255),
    tanggal_dasar date,
    status_dasar character varying(20) DEFAULT 'belum_diketahui'::character varying NOT NULL,
    diganti_oleh character varying(255)
);


--
-- Name: knowledge_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_articles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_articles_id_seq OWNED BY public.knowledge_articles.id;


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_documents (
    id bigint NOT NULL,
    original_name character varying(255) NOT NULL,
    path character varying(255) NOT NULL,
    size integer DEFAULT 0 NOT NULL,
    pages integer,
    status character varying(20) DEFAULT 'diproses'::character varying NOT NULL,
    error text,
    proposals json,
    uploaded_by bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_documents_id_seq OWNED BY public.knowledge_documents.id;


--
-- Name: knowledge_passages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_passages (
    id bigint NOT NULL,
    knowledge_source_id bigint NOT NULL,
    url character varying(1000),
    title character varying(255),
    heading character varying(255),
    page integer,
    body text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: knowledge_passages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_passages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_passages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_passages_id_seq OWNED BY public.knowledge_passages.id;


--
-- Name: knowledge_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_sources (
    id bigint NOT NULL,
    kind character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    url character varying(1000),
    knowledge_document_id bigint,
    follow_links boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    public_file boolean DEFAULT true NOT NULL,
    status character varying(20) DEFAULT 'antre'::character varying NOT NULL,
    error text,
    pages_count integer DEFAULT 0 NOT NULL,
    passages_count integer DEFAULT 0 NOT NULL,
    used_count integer DEFAULT 0 NOT NULL,
    content_hash character varying(64),
    fetched_at timestamp(0) without time zone,
    changed_at timestamp(0) without time zone,
    created_by bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    dasar_hukum character varying(255),
    tanggal_dasar date,
    status_dasar character varying(20) DEFAULT 'belum_diketahui'::character varying NOT NULL,
    diganti_oleh character varying(255)
);


--
-- Name: knowledge_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_sources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_sources_id_seq OWNED BY public.knowledge_sources.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: personal_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_access_tokens (
    id bigint NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name text NOT NULL,
    token character varying(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personal_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personal_access_tokens_id_seq OWNED BY public.personal_access_tokens.id;


--
-- Name: portals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portals (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(100) NOT NULL,
    url character varying(500) NOT NULL,
    action_url character varying(500),
    action_label character varying(60),
    audience character varying(10) DEFAULT 'publik'::character varying NOT NULL,
    purpose character varying(255) NOT NULL,
    description text,
    keywords character varying(500),
    steps text,
    prepare text,
    proof_label character varying(60),
    track_completion boolean DEFAULT false NOT NULL,
    managed_by character varying(150),
    contact character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    sort smallint DEFAULT '0'::smallint NOT NULL,
    is_reachable boolean DEFAULT true NOT NULL,
    last_status smallint,
    last_checked_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: portals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.portals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.portals_id_seq OWNED BY public.portals.id;


--
-- Name: referral_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_events (
    id bigint NOT NULL,
    referral_id bigint NOT NULL,
    user_id bigint,
    actor character varying(10) NOT NULL,
    type character varying(30) NOT NULL,
    note text,
    created_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: referral_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referral_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referral_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referral_events_id_seq OWNED BY public.referral_events.id;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id bigint NOT NULL,
    token character varying(64) NOT NULL,
    code character varying(20) NOT NULL,
    portal_id bigint NOT NULL,
    conversation_id bigint,
    user_id bigint,
    citizen_name character varying(120),
    contact text,
    summary text,
    status character varying(20) DEFAULT 'dirujuk'::character varying NOT NULL,
    external_ref character varying(100),
    assigned_to bigint,
    created_by bigint,
    opened_at timestamp(0) without time zone,
    confirmed_at timestamp(0) without time zone,
    follow_up_due_at timestamp(0) without time zone,
    reminded_at timestamp(0) without time zone,
    closed_at timestamp(0) without time zone,
    closed_by bigint,
    close_reason text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    citizen_reminded_at timestamp(0) without time zone
);


--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referrals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    province character varying(100),
    latitude numeric(10,6),
    longitude numeric(10,6),
    geometry json,
    infrastructure_status character varying(50),
    kk_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: regions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regions_id_seq OWNED BY public.regions.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id bigint NOT NULL,
    key character varying(100) NOT NULL,
    value json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surveys (
    id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    rating smallint,
    comment text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    version smallint DEFAULT '1'::smallint NOT NULL,
    answers json,
    overall smallint,
    resolved character varying(10),
    reuse smallint,
    good_feedback text,
    improve_feedback text,
    age_group character varying(20),
    education character varying(20),
    occupation character varying(30),
    skm_index numeric(5,2)
);


--
-- Name: surveys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.surveys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: surveys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.surveys_id_seq OWNED BY public.surveys.id;


--
-- Name: ticket_dispositions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_dispositions (
    id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    assigned_by bigint,
    accepted_by bigint,
    closed_by bigint,
    status character varying(20) DEFAULT 'menunggu'::character varying NOT NULL,
    note text,
    due_at timestamp(0) without time zone,
    accepted_at timestamp(0) without time zone,
    closed_at timestamp(0) without time zone,
    return_reason text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: ticket_dispositions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_dispositions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_dispositions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_dispositions_id_seq OWNED BY public.ticket_dispositions.id;


--
-- Name: ticket_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_histories (
    id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    from_status character varying(20),
    to_status character varying(20) NOT NULL,
    actor_id bigint,
    note text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: ticket_histories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_histories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_histories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_histories_id_seq OWNED BY public.ticket_histories.id;


--
-- Name: ticket_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_replies (
    id bigint NOT NULL,
    ticket_id bigint NOT NULL,
    author_id bigint,
    body text NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: ticket_replies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_replies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_replies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_replies_id_seq OWNED BY public.ticket_replies.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id bigint NOT NULL,
    ticket_no character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    status character varying(20) DEFAULT 'baru'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'umum'::character varying NOT NULL,
    impact character varying(20),
    visibility character varying(20) DEFAULT 'publik'::character varying NOT NULL,
    latitude numeric(10,6),
    longitude numeric(10,6),
    attachment_path character varying(500),
    is_internal boolean DEFAULT false NOT NULL,
    category_id bigint,
    region_id bigint,
    channel_id bigint,
    assignee_id bigint,
    reporter_id bigint,
    reporter_name character varying(150),
    reporter_nik text,
    reporter_email character varying(150),
    reporter_phone character varying(30),
    sla_due_at timestamp(0) without time zone,
    responded_at timestamp(0) without time zone,
    resolved_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    ews_notified_at timestamp(0) without time zone,
    source character varying(30),
    source_url character varying(500),
    received_by character varying(150),
    reporter_nip character varying(30),
    reporter_unit character varying(120),
    location character varying(150),
    reporter_nik_hash character varying(64),
    lookup_token character varying(16),
    province character varying(60),
    reporter_unit_id bigint,
    unit_id bigint,
    disposed_at timestamp(0) without time zone,
    review_requested_at timestamp(0) without time zone,
    review_reason character varying(20),
    reviewed_at timestamp(0) without time zone,
    reviewed_by bigint,
    survey_reminded_at timestamp(0) without time zone
);


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(200) NOT NULL,
    short_name character varying(60),
    parent_id bigint,
    level character varying(20) DEFAULT 'lainnya'::character varying NOT NULL,
    email character varying(150),
    is_active boolean DEFAULT true NOT NULL,
    sort smallint DEFAULT '0'::smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    nik text,
    username character varying(50),
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(30),
    role character varying(20) DEFAULT 'warga'::character varying NOT NULL,
    region_id bigint,
    unit character varying(120),
    is_active boolean DEFAULT true NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password character varying(255) NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    nik_hash character varying(64),
    registered_by bigint,
    activated_at timestamp(0) without time zone,
    unit_id bigint
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: account_activations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_activations ALTER COLUMN id SET DEFAULT nextval('public.account_activations_id_seq'::regclass);


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: ai_calls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_calls ALTER COLUMN id SET DEFAULT nextval('public.ai_calls_id_seq'::regclass);


--
-- Name: ai_quality_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_quality_runs ALTER COLUMN id SET DEFAULT nextval('public.ai_quality_runs_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: channel_sync_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_sync_logs ALTER COLUMN id SET DEFAULT nextval('public.channel_sync_logs_id_seq'::regclass);


--
-- Name: channels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels ALTER COLUMN id SET DEFAULT nextval('public.channels_id_seq'::regclass);


--
-- Name: chat_conversations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations ALTER COLUMN id SET DEFAULT nextval('public.chat_conversations_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: knowledge_articles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles ALTER COLUMN id SET DEFAULT nextval('public.knowledge_articles_id_seq'::regclass);


--
-- Name: knowledge_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents ALTER COLUMN id SET DEFAULT nextval('public.knowledge_documents_id_seq'::regclass);


--
-- Name: knowledge_passages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_passages ALTER COLUMN id SET DEFAULT nextval('public.knowledge_passages_id_seq'::regclass);


--
-- Name: knowledge_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources ALTER COLUMN id SET DEFAULT nextval('public.knowledge_sources_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: personal_access_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.personal_access_tokens_id_seq'::regclass);


--
-- Name: portals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portals ALTER COLUMN id SET DEFAULT nextval('public.portals_id_seq'::regclass);


--
-- Name: referral_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_events ALTER COLUMN id SET DEFAULT nextval('public.referral_events_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);


--
-- Name: regions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions ALTER COLUMN id SET DEFAULT nextval('public.regions_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: surveys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys ALTER COLUMN id SET DEFAULT nextval('public.surveys_id_seq'::regclass);


--
-- Name: ticket_dispositions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_dispositions ALTER COLUMN id SET DEFAULT nextval('public.ticket_dispositions_id_seq'::regclass);


--
-- Name: ticket_histories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_histories ALTER COLUMN id SET DEFAULT nextval('public.ticket_histories_id_seq'::regclass);


--
-- Name: ticket_replies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_replies ALTER COLUMN id SET DEFAULT nextval('public.ticket_replies_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: account_activations account_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_activations
    ADD CONSTRAINT account_activations_pkey PRIMARY KEY (id);


--
-- Name: account_activations account_activations_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_activations
    ADD CONSTRAINT account_activations_token_hash_unique UNIQUE (token_hash);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_calls ai_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_calls
    ADD CONSTRAINT ai_calls_pkey PRIMARY KEY (id);


--
-- Name: ai_quality_runs ai_quality_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_quality_runs
    ADD CONSTRAINT ai_quality_runs_pkey PRIMARY KEY (id);


--
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- Name: categories categories_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_unique UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_unique UNIQUE (slug);


--
-- Name: channel_sync_logs channel_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_sync_logs
    ADD CONSTRAINT channel_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_conversations chat_conversations_reference_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_reference_unique UNIQUE (reference);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: knowledge_articles knowledge_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: knowledge_passages knowledge_passages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_passages
    ADD CONSTRAINT knowledge_passages_pkey PRIMARY KEY (id);


--
-- Name: knowledge_sources knowledge_sources_knowledge_document_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_knowledge_document_id_unique UNIQUE (knowledge_document_id);


--
-- Name: knowledge_sources knowledge_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: personal_access_tokens personal_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);


--
-- Name: portals portals_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portals
    ADD CONSTRAINT portals_code_unique UNIQUE (code);


--
-- Name: portals portals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portals
    ADD CONSTRAINT portals_pkey PRIMARY KEY (id);


--
-- Name: referral_events referral_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_events
    ADD CONSTRAINT referral_events_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_code_unique UNIQUE (code);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_token_unique UNIQUE (token);


--
-- Name: regions regions_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_code_unique UNIQUE (code);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_unique UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: surveys surveys_ticket_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_ticket_id_unique UNIQUE (ticket_id);


--
-- Name: ticket_dispositions ticket_dispositions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_dispositions
    ADD CONSTRAINT ticket_dispositions_pkey PRIMARY KEY (id);


--
-- Name: ticket_histories ticket_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_histories
    ADD CONSTRAINT ticket_histories_pkey PRIMARY KEY (id);


--
-- Name: ticket_replies ticket_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT ticket_replies_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_no_unique UNIQUE (ticket_no);


--
-- Name: units units_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_code_unique UNIQUE (code);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_nik_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_nik_hash_unique UNIQUE (nik_hash);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: account_activations_conversation_id_used_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_activations_conversation_id_used_at_index ON public.account_activations USING btree (conversation_id, used_at);


--
-- Name: activity_logs_action_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_action_created_at_index ON public.activity_logs USING btree (action, created_at);


--
-- Name: activity_logs_subject_type_subject_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_subject_type_subject_id_index ON public.activity_logs USING btree (subject_type, subject_id);


--
-- Name: ai_calls_status_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_calls_status_created_at_index ON public.ai_calls USING btree (status, created_at);


--
-- Name: ai_calls_task_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_calls_task_created_at_index ON public.ai_calls USING btree (task, created_at);


--
-- Name: ai_quality_runs_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_quality_runs_created_at_index ON public.ai_quality_runs USING btree (created_at);


--
-- Name: chat_conversations_guest_token_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_guest_token_index ON public.chat_conversations USING btree (guest_token);


--
-- Name: chat_conversations_outcome_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_outcome_index ON public.chat_conversations USING btree (outcome);


--
-- Name: chat_conversations_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_user_id_index ON public.chat_conversations USING btree (user_id);


--
-- Name: chat_messages_conversation_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_messages_conversation_id_created_at_index ON public.chat_messages USING btree (conversation_id, created_at);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: knowledge_articles_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_articles_status_index ON public.knowledge_articles USING btree (status);


--
-- Name: personal_access_tokens_expires_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_expires_at_index ON public.personal_access_tokens USING btree (expires_at);


--
-- Name: personal_access_tokens_tokenable_type_tokenable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);


--
-- Name: referrals_follow_up_due_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referrals_follow_up_due_at_index ON public.referrals USING btree (follow_up_due_at);


--
-- Name: referrals_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX referrals_status_index ON public.referrals USING btree (status);


--
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- Name: ticket_dispositions_ticket_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_dispositions_ticket_id_created_at_index ON public.ticket_dispositions USING btree (ticket_id, created_at);


--
-- Name: ticket_dispositions_unit_id_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_dispositions_unit_id_status_index ON public.ticket_dispositions USING btree (unit_id, status);


--
-- Name: ticket_histories_ticket_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_histories_ticket_id_index ON public.ticket_histories USING btree (ticket_id);


--
-- Name: ticket_replies_ticket_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_replies_ticket_id_index ON public.ticket_replies USING btree (ticket_id);


--
-- Name: tickets_assignee_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_assignee_id_index ON public.tickets USING btree (assignee_id);


--
-- Name: tickets_category_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_category_id_index ON public.tickets USING btree (category_id);


--
-- Name: tickets_channel_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_channel_id_index ON public.tickets USING btree (channel_id);


--
-- Name: tickets_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_created_at_index ON public.tickets USING btree (created_at);


--
-- Name: tickets_impact_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_impact_index ON public.tickets USING btree (impact);


--
-- Name: tickets_is_internal_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_is_internal_index ON public.tickets USING btree (is_internal);


--
-- Name: tickets_priority_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_priority_index ON public.tickets USING btree (priority);


--
-- Name: tickets_province_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_province_index ON public.tickets USING btree (province);


--
-- Name: tickets_region_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_region_id_index ON public.tickets USING btree (region_id);


--
-- Name: tickets_reporter_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_reporter_id_index ON public.tickets USING btree (reporter_id);


--
-- Name: tickets_reporter_nik_hash_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_reporter_nik_hash_index ON public.tickets USING btree (reporter_nik_hash);


--
-- Name: tickets_review_requested_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_review_requested_at_index ON public.tickets USING btree (review_requested_at);


--
-- Name: tickets_sla_due_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_sla_due_at_index ON public.tickets USING btree (sla_due_at);


--
-- Name: tickets_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_status_index ON public.tickets USING btree (status);


--
-- Name: units_parent_id_sort_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX units_parent_id_sort_index ON public.units USING btree (parent_id, sort);


--
-- Name: users_region_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_region_id_index ON public.users USING btree (region_id);


--
-- Name: users_role_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_index ON public.users USING btree (role);


--
-- Name: account_activations account_activations_conversation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_activations
    ADD CONSTRAINT account_activations_conversation_id_foreign FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE SET NULL;


--
-- Name: account_activations account_activations_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_activations
    ADD CONSTRAINT account_activations_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: account_activations account_activations_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_activations
    ADD CONSTRAINT account_activations_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_calls ai_calls_conversation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_calls
    ADD CONSTRAINT ai_calls_conversation_id_foreign FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE SET NULL;


--
-- Name: channel_sync_logs channel_sync_logs_channel_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_sync_logs
    ADD CONSTRAINT channel_sync_logs_channel_id_foreign FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_assigned_to_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_assigned_to_foreign FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_closed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_closed_by_foreign FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_ticket_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_ticket_id_foreign FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_conversation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_foreign FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_foreign FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_articles knowledge_articles_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_articles knowledge_articles_knowledge_document_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_knowledge_document_id_foreign FOREIGN KEY (knowledge_document_id) REFERENCES public.knowledge_documents(id) ON DELETE SET NULL;


--
-- Name: knowledge_articles knowledge_articles_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_documents knowledge_documents_uploaded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_uploaded_by_foreign FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_passages knowledge_passages_knowledge_source_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_passages
    ADD CONSTRAINT knowledge_passages_knowledge_source_id_foreign FOREIGN KEY (knowledge_source_id) REFERENCES public.knowledge_sources(id) ON DELETE CASCADE;


--
-- Name: knowledge_sources knowledge_sources_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_sources knowledge_sources_knowledge_document_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_knowledge_document_id_foreign FOREIGN KEY (knowledge_document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: referral_events referral_events_referral_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_events
    ADD CONSTRAINT referral_events_referral_id_foreign FOREIGN KEY (referral_id) REFERENCES public.referrals(id) ON DELETE CASCADE;


--
-- Name: referral_events referral_events_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_events
    ADD CONSTRAINT referral_events_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_assigned_to_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_assigned_to_foreign FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_closed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_closed_by_foreign FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_conversation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_conversation_id_foreign FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_portal_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_portal_id_foreign FOREIGN KEY (portal_id) REFERENCES public.portals(id) ON DELETE RESTRICT;


--
-- Name: referrals referrals_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: surveys surveys_ticket_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_ticket_id_foreign FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_dispositions ticket_dispositions_accepted_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_dispositions
    ADD CONSTRAINT ticket_dispositions_accepted_by_foreign FOREIGN KEY (accepted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_dispositions ticket_dispositions_assigned_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_dispositions
    ADD CONSTRAINT ticket_dispositions_assigned_by_foreign FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_dispositions ticket_dispositions_closed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_dispositions
    ADD CONSTRAINT ticket_dispositions_closed_by_foreign FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_dispositions ticket_dispositions_ticket_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_dispositions
    ADD CONSTRAINT ticket_dispositions_ticket_id_foreign FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_dispositions ticket_dispositions_unit_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_dispositions
    ADD CONSTRAINT ticket_dispositions_unit_id_foreign FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: ticket_histories ticket_histories_actor_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_histories
    ADD CONSTRAINT ticket_histories_actor_id_foreign FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_histories ticket_histories_ticket_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_histories
    ADD CONSTRAINT ticket_histories_ticket_id_foreign FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_replies ticket_replies_author_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT ticket_replies_author_id_foreign FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_replies ticket_replies_ticket_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT ticket_replies_ticket_id_foreign FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_assignee_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assignee_id_foreign FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_channel_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_channel_id_foreign FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_region_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_region_id_foreign FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_reporter_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_reporter_id_foreign FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_reporter_unit_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_reporter_unit_id_foreign FOREIGN KEY (reporter_unit_id) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_reviewed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_reviewed_by_foreign FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_unit_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_unit_id_foreign FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- Name: units units_parent_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_parent_id_foreign FOREIGN KEY (parent_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: users users_region_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_region_id_foreign FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;


--
-- Name: users users_registered_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_registered_by_foreign FOREIGN KEY (registered_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_unit_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_unit_id_foreign FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict ccuji

